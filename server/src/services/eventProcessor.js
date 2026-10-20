import { DeviceEvent } from '../models/DeviceEvent.js';
import { DoseInstance } from '../models/DoseInstance.js';
import { Medicine } from '../models/Medicine.js';
import { Patient } from '../models/Patient.js';
import { Settings } from '../models/Settings.js';
import { getLocalDateString, formatToLocalTime } from '../utils/dateUtils.js';
import { sendSmsNotification } from './notificationService.js';

let ioInstance = null;

export function setSocketIo(io) {
  ioInstance = io;
}

/**
 * Process a compartment event reported by ESP32
 * Handles debouncing, deduplication, delayed reconciliation, and alerts.
 */
export async function processDeviceEvent({
  device,
  eventId,
  deviceTimestamp,
  compartment,
  lidState,
  isBuffered = false
}) {
  // 1. Deduplication check
  let existingEvent = await DeviceEvent.findOne({ eventId });
  if (existingEvent) {
    console.log(`[EventProcessor] Duplicate event ${eventId} ignored.`);
    return {
      success: true,
      deduplicated: true,
      eventType: existingEvent.eventType,
      expectedCompartment: existingEvent.doseInstanceId ? undefined : null,
      openedCompartment: existingEvent.compartment,
      event: existingEvent
    };
  }

  // 2. Load Patient & Settings
  const patient = await Patient.findById(device.patientId);
  const patientTz = patient?.timezone || 'Asia/Kolkata';
  const eventDateUtc = new Date(deviceTimestamp || Date.now());
  const dateStr = getLocalDateString(patientTz, eventDateUtc);

  // 3. Find active medicines for this patient and device
  const activeMedicines = await Medicine.find({
    deviceId: device._id,
    isActive: true
  });

  // Find medicine specifically assigned to this compartment
  const targetMedicine = activeMedicines.find((m) => m.compartment === compartment);

  // Find any medicine that currently has a pending dose instance for this date
  const pendingDoses = await DoseInstance.find({
    patientId: device.patientId,
    date: dateStr,
    status: { $in: ['pending', 'wrong_compartment_opened'] }
  }).populate('medicineId');

  let eventType = lidState === 'closed' ? 'lid_closed' : 'unscheduled_access';
  let matchedDose = null;
  let expectedCompartment = null;

  if (lidState === 'open') {
    // Check if the opened compartment matches a pending dose
    const matchingPendingDose = pendingDoses.find(
      (d) => d.medicineId && d.medicineId.compartment === compartment
    );

    if (matchingPendingDose) {
      // CORRECT COMPARTMENT ACCESSED
      eventType = 'normal_access';
      matchedDose = matchingPendingDose;
      expectedCompartment = compartment;

      // Update Dose Instance
      matchedDose.status = 'accessed';
      matchedDose.accessedAt = eventDateUtc;
      matchedDose.wrongCompartmentOpened = null;
      await matchedDose.save();

      // Send SMS alert to caregiver if configured
      const settings = await Settings.findOne({ userId: device.caregiverId });
      if (settings?.smsEnabled && settings.smsRecipientNumber) {
        const timeFormatted = formatToLocalTime(eventDateUtc, patientTz);
        const patientName = patient?.name || 'Your family member';
        const msg = `MediMate: ${patientName}'s scheduled medicine compartment was accessed successfully at ${timeFormatted}. Medicine: ${matchingPendingDose.medicineId.name}, Compartment ${compartment}.`;

        await sendSmsNotification({
          userId: device.caregiverId,
          patientId: device.patientId,
          doseId: matchedDose._id,
          recipient: settings.smsRecipientNumber,
          message: msg,
          notificationType: 'dose_accessed'
        });
      }
    } else if (pendingDoses.length > 0) {
      // WRONG COMPARTMENT OPENED! A dose is due, but a different compartment was opened
      eventType = 'wrong_access';
      matchedDose = pendingDoses[0]; // The pending dose that was expected
      expectedCompartment = matchedDose.medicineId?.compartment;

      // Mark dose with wrong compartment warning
      matchedDose.status = 'wrong_compartment_opened';
      matchedDose.wrongCompartmentOpened = compartment;
      matchedDose.wrongCompartmentOpenedAt = eventDateUtc;
      await matchedDose.save();
    } else {
      // Unscheduled opening when no dose is pending
      eventType = 'unscheduled_access';
    }
  }

  // 4. Save DeviceEvent record
  const newEvent = await DeviceEvent.create({
    deviceId: device._id,
    eventId,
    deviceTimestamp: eventDateUtc,
    serverTimestamp: new Date(),
    compartment,
    lidState,
    eventType,
    doseInstanceId: matchedDose?._id || null,
    medicineId: targetMedicine?._id || matchedDose?.medicineId?._id || null,
    isBufferedUpload: isBuffered,
    processed: true
  });

  if (matchedDose && eventType === 'normal_access') {
    matchedDose.qualifyingEventId = newEvent._id;
    await matchedDose.save();
  }

  // 5. Emit real-time Socket.IO notification to caregiver
  if (ioInstance && device.caregiverId) {
    const socketPayload = {
      deviceId: device.deviceId,
      compartment,
      lidState,
      eventType,
      expectedCompartment,
      eventTimestamp: eventDateUtc,
      dose: matchedDose
    };

    ioInstance.to(`caregiver:${device.caregiverId}`).emit('device:event', socketPayload);
    ioInstance.to(`caregiver:${device.caregiverId}`).emit('dashboard:update');
  }

  return {
    success: true,
    eventType,
    expectedCompartment,
    openedCompartment: compartment,
    event: newEvent
  };
}
