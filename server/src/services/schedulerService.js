import cron from 'node-cron';
import { Medicine } from '../models/Medicine.js';
import { DoseInstance } from '../models/DoseInstance.js';
import { Patient } from '../models/Patient.js';
import { Settings } from '../models/Settings.js';
import { getLocalDateString, parseLocalTimeToUtc, formatToLocalTime } from '../utils/dateUtils.js';
import { sendSmsNotification, sendPushNotification } from './notificationService.js';

let ioInstance = null;

export function setSchedulerSocketIo(io) {
  ioInstance = io;
}

/**
 * Ensures today's dose instances are populated for all active medicines
 */
export async function populateDailyDoseInstances() {
  try {
    const medicines = await Medicine.find({ isActive: true }).populate('patientId');
    const now = new Date();

    for (const med of medicines) {
      if (!med.patientId) continue;
      const tz = med.patientId.timezone || 'Asia/Kolkata';
      const todayStr = getLocalDateString(tz, now);

      const scheduledUtc = parseLocalTimeToUtc(todayStr, med.scheduledTime, tz);
      let deadlineUtc = parseLocalTimeToUtc(todayStr, med.deadlineTime, tz);

      // Check if today is on or after the medicine's configured start date
      if (med.startDate && todayStr < med.startDate) {
        continue;
      }
      if (med.endDate && todayStr > med.endDate) {
        continue;
      }

      // Check if today matches configured days of week
      if (med.frequency === 'specific_days' && Array.isArray(med.daysOfWeek) && med.daysOfWeek.length > 0) {
        const currentDayName = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'short'
        }).format(now);
        if (!med.daysOfWeek.includes(currentDayName)) {
          continue;
        }
      }

      // Handle deadline spanning past midnight
      if (deadlineUtc <= scheduledUtc) {
        deadlineUtc = new Date(deadlineUtc.getTime() + 24 * 60 * 60 * 1000);
      }

      // Check if instance already exists (idempotent find or create)
      const existing = await DoseInstance.findOne({
        medicineId: med._id,
        date: todayStr
      });

      if (!existing) {
        await DoseInstance.create({
          medicineId: med._id,
          patientId: med.patientId._id,
          deviceId: med.deviceId,
          date: todayStr,
          scheduledTimeUtc: scheduledUtc,
          deadlineTimeUtc: deadlineUtc,
          status: 'pending'
        });
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error populating dose instances:', error.message);
  }
}

/**
 * Evaluates deadlines and processes missed doses
 */
export async function evaluateDeadlinesAndProcessMissedDoses() {
  try {
    const now = new Date();

    // Find all dose instances that passed their deadline, are NOT accessed, and have NOT been processed for missed status yet
    const expiredDoses = await DoseInstance.find({
      deadlineTimeUtc: { $lte: now },
      status: { $in: ['pending', 'wrong_compartment_opened'] },
      missedDoseProcessed: false
    }).populate('medicineId').populate('patientId');

    for (const dose of expiredDoses) {
      if (!dose.medicineId || !dose.patientId) continue;

      // Mark dose missed
      dose.status = 'missed';
      dose.missedDoseProcessed = true;
      await dose.save();

      const patient = dose.patientId;
      const med = dose.medicineId;
      const tz = patient.timezone || 'Asia/Kolkata';
      const deadlineStr = formatToLocalTime(dose.deadlineTimeUtc, tz);
      const patientName = patient.name || 'Your family member';

      // Load caregiver settings for SMS and Push
      const settings = await Settings.findOne({ userId: patient.caregiverId });

      // 1. Send SMS Alert
      if (settings?.smsEnabled && settings.smsRecipientNumber && !dose.smsAlertSent) {
        const smsMessage = `MediMate Alert: ${patientName}'s scheduled ${med.name} dose was not recorded by the ${deadlineStr} deadline. Please check on them.`;
        await sendSmsNotification({
          userId: patient.caregiverId,
          patientId: patient._id,
          doseId: dose._id,
          recipient: settings.smsRecipientNumber,
          message: smsMessage,
          notificationType: 'dose_missed'
        });
        dose.smsAlertSent = true;
      }

      // 2. Send Browser Push Alert
      if (settings?.pushEnabled && settings.pushSubscriptions?.length > 0 && !dose.pushAlertSent) {
        await sendPushNotification({
          userId: patient.caregiverId,
          patientId: patient._id,
          doseId: dose._id,
          subscriptions: settings.pushSubscriptions,
          title: `Medicine Reminder Missed — ${med.name}`,
          body: `The deadline (${deadlineStr}) has passed without compartment access. Please check on ${patientName}.`,
          notificationType: 'dose_missed'
        });
        dose.pushAlertSent = true;
      }

      await dose.save();

      // Emit live dashboard alert via Socket.IO
      if (ioInstance && patient.caregiverId) {
        ioInstance.to(`caregiver:${patient.caregiverId}`).emit('dose:missed', {
          doseId: dose._id,
          medicineName: med.name,
          compartment: med.compartment,
          deadline: deadlineStr
        });
        ioInstance.to(`caregiver:${patient.caregiverId}`).emit('dashboard:update');
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error evaluating deadlines:', error.message);
  }
}

/**
 * Start cron scheduler jobs
 */
export function startScheduler() {
  console.log('[Scheduler] Initializing MediMate background scheduler...');

  // Run initial sync on boot
  populateDailyDoseInstances().then(() => evaluateDeadlinesAndProcessMissedDoses());

  // Run every minute: ensure daily doses exist and check for deadlines
  cron.schedule('* * * * *', async () => {
    await populateDailyDoseInstances();
    await evaluateDeadlinesAndProcessMissedDoses();
  });
}
