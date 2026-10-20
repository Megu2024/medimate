import { Patient } from '../models/Patient.js';
import { Device } from '../models/Device.js';
import { Medicine } from '../models/Medicine.js';
import { DoseInstance } from '../models/DoseInstance.js';
import { DeviceEvent } from '../models/DeviceEvent.js';
import { getLocalDateString, formatToLocalTime } from '../utils/dateUtils.js';

/**
 * Get comprehensive dashboard data
 */
export async function getDashboard(req, res, next) {
  try {
    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const device = await Device.findOne({ patientId: patient._id });
    const patientTz = patient.timezone || 'Asia/Kolkata';
    const todayStr = getLocalDateString(patientTz);
    const now = new Date();

    // Fetch active medicines
    const medicines = await Medicine.find({
      patientId: patient._id,
      isActive: true
    }).sort({ compartment: 1 });

    // Fetch today's dose instances
    const todayDoses = await DoseInstance.find({
      patientId: patient._id,
      date: todayStr
    }).populate('medicineId').populate('qualifyingEventId');

    // Build compartment status array for 1, 2, 3
    const compartmentCards = [1, 2, 3].map((compNum) => {
      const med = medicines.find((m) => m.compartment === compNum);
      if (!med) {
        return {
          compartment: compNum,
          isConfigured: false,
          medicine: null,
          status: 'grey', // unconfigured
          statusLabel: 'Compartment Unassigned',
          message: 'No medicine assigned to this compartment.'
        };
      }

      const dose = todayDoses.find(
        (d) => d.medicineId && d.medicineId._id.toString() === med._id.toString()
      );

      let visualStatus = 'amber';
      let statusLabel = 'Upcoming / Pending';
      let message = `Scheduled at ${med.scheduledTime} (Deadline: ${med.deadlineTime})`;
      let eventTime = null;

      if (dose) {
        if (dose.status === 'accessed') {
          visualStatus = 'green';
          statusLabel = 'Taken / Accessed';
          eventTime = dose.accessedAt ? formatToLocalTime(dose.accessedAt, patientTz) : null;
          message = `Compartment ${compNum} accessed as expected at ${eventTime || med.scheduledTime}.`;
        } else if (dose.status === 'missed') {
          visualStatus = 'red';
          statusLabel = 'Missed Dose';
          message = `Warning: Dose missed! Deadline was ${med.deadlineTime}.`;
        } else if (dose.status === 'wrong_compartment_opened') {
          visualStatus = 'orange';
          statusLabel = 'Wrong Compartment Alert';
          const wrongComp = dose.wrongCompartmentOpened;
          message = `Alert: Patient opened Compartment ${wrongComp} instead of Compartment ${compNum}.`;
        } else {
          // Check if currently due or upcoming
          if (now >= dose.scheduledTimeUtc && now <= dose.deadlineTimeUtc) {
            visualStatus = 'amber';
            statusLabel = 'Due Now';
            message = `Active reminder window! Compartment ${compNum} should be accessed before ${med.deadlineTime}.`;
          } else if (now < dose.scheduledTimeUtc) {
            visualStatus = 'amber';
            statusLabel = 'Upcoming';
            message = `Scheduled for ${med.scheduledTime} today.`;
          }
        }
      }

      return {
        compartment: compNum,
        isConfigured: true,
        medicine: {
          id: med._id,
          name: med.name,
          category: med.category,
          scheduledTime: med.scheduledTime,
          repeatIntervalMinutes: med.repeatIntervalMinutes,
          deadlineTime: med.deadlineTime,
          notes: med.notes
        },
        dose: dose
          ? {
              id: dose._id,
              status: dose.status,
              accessedAt: dose.accessedAt,
              wrongCompartmentOpened: dose.wrongCompartmentOpened
            }
          : null,
        status: visualStatus,
        statusLabel,
        message,
        eventTime
      };
    });

    // Summary calculation
    const totalConfigured = medicines.length;
    const dosesScheduledToday = todayDoses.length;
    const dosesAccessedToday = todayDoses.filter((d) => d.status === 'accessed').length;
    const missedDosesToday = todayDoses.filter((d) => d.status === 'missed').length;

    // Determine next upcoming dose
    const upcomingDose = todayDoses
      .filter((d) => d.status === 'pending' && d.scheduledTimeUtc > now)
      .sort((a, b) => a.scheduledTimeUtc - b.scheduledTimeUtc)[0];

    // Recent device events (last 5)
    const recentEvents = device
      ? await DeviceEvent.find({ deviceId: device._id })
          .sort({ deviceTimestamp: -1 })
          .limit(5)
          .populate('medicineId', 'name compartment')
      : [];

    res.status(200).json({
      success: true,
      patient: {
        id: patient._id,
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
        age: patient.age,
        relationship: patient.relationship,
        photoUrl: patient.photoUrl,
        timezone: patientTz
      },
      device: device
        ? {
            id: device._id,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            isOnline: device.isOnline,
            lastHeartbeat: device.lastHeartbeat,
            lastHeartbeatFormatted: device.lastHeartbeat
              ? formatToLocalTime(device.lastHeartbeat, patientTz)
              : 'Never',
            lastSyncTime: device.lastSyncTime
          }
        : null,
      todayDateFormatted: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: patientTz
      }).format(now),
      todayDateIso: todayStr,
      summary: {
        totalConfigured,
        dosesScheduledToday,
        dosesAccessedToday,
        missedDosesToday,
        upcomingMedicine: upcomingDose?.medicineId?.name || 'None pending',
        upcomingTime: upcomingDose?.medicineId?.scheduledTime || '—'
      },
      compartmentCards,
      recentEvents: recentEvents.map((e) => ({
        id: e._id,
        eventId: e.eventId,
        compartment: e.compartment,
        lidState: e.lidState,
        eventType: e.eventType,
        timestamp: formatToLocalTime(e.deviceTimestamp, patientTz),
        medicineName: e.medicineId?.name || null
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get dose history with filters (date range, status, medicine)
 */
export async function getDoseHistory(req, res, next) {
  try {
    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const { status, medicineId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = { patientId: patient._id };

    if (status) query.status = status;
    if (medicineId) query.medicineId = medicineId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await DoseInstance.countDocuments(query);

    const doses = await DoseInstance.find(query)
      .sort({ date: -1, scheduledTimeUtc: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('medicineId', 'name category compartment scheduledTime deadlineTime')
      .populate('qualifyingEventId');

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      doses
    });
  } catch (error) {
    next(error);
  }
}
