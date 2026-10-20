import { Medicine } from '../models/Medicine.js';
import { Device } from '../models/Device.js';
import { DoseInstance } from '../models/DoseInstance.js';
import { getLocalDateString, parseLocalTimeToUtc } from '../utils/dateUtils.js';

/**
 * Get available compartments (1, 2, 3) for the patient's device
 */
export async function getAvailableCompartments(req, res, next) {
  try {
    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const device = await Device.findOne({ patientId: patient._id });
    if (!device) {
      return res.status(404).json({ success: false, message: 'No device paired with this patient.' });
    }

    const activeMedicines = await Medicine.find({
      deviceId: device._id,
      isActive: true
    }).select('compartment name category scheduledTime');

    const occupiedCompartments = activeMedicines.map((m) => m.compartment);
    const allCompartments = [1, 2, 3];
    const availableCompartments = allCompartments.filter(
      (c) => !occupiedCompartments.includes(c)
    );

    res.status(200).json({
      success: true,
      allCompartments,
      occupiedCompartments,
      availableCompartments,
      activeCount: occupiedCompartments.length,
      maxAllowed: 3,
      isFull: occupiedCompartments.length >= 3
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all medicines for the patient
 */
export async function getMedicines(req, res, next) {
  try {
    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const medicines = await Medicine.find({ patientId: patient._id })
      .sort({ isActive: -1, compartment: 1, scheduledTime: 1 });

    res.status(200).json({
      success: true,
      count: medicines.length,
      medicines
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a new medicine
 */
export async function addMedicine(req, res, next) {
  try {
    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    let device = await Device.findOne({ patientId: patient._id });
    if (!device) {
      // Auto-provision device if not found
      device = await Device.create({
        caregiverId: req.user._id,
        patientId: patient._id,
        deviceId: `MEDIMATE-${Math.floor(1000 + Math.random() * 9000)}`,
        deviceName: `${patient.name}'s Smart Medicine Box`,
        isPaired: true
      });
    }

    const {
      name,
      category,
      compartment,
      scheduledTime,
      repeatIntervalMinutes,
      deadlineTime,
      startDate,
      endDate,
      frequency,
      daysOfWeek,
      notes
    } = req.body;

    const compNum = Number(compartment);
    if (![1, 2, 3].includes(compNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid compartment number. Must be 1, 2, or 3.'
      });
    }

    // Check count of active medicines
    const activeCount = await Medicine.countDocuments({
      deviceId: device._id,
      isActive: true
    });

    if (activeCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'All 3 compartments are already occupied. Deactivate or edit an existing medicine first.'
      });
    }

    // Check if this specific compartment is already occupied by an active medicine
    const existingActive = await Medicine.findOne({
      deviceId: device._id,
      compartment: compNum,
      isActive: true
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: `Compartment ${compNum} is already assigned to "${existingActive.name}". Please select a different compartment.`
      });
    }

    const todayStr = getLocalDateString(patient.timezone || 'Asia/Kolkata');
    const effectiveStartDate = startDate || todayStr;

    // Create the medicine
    const medicine = await Medicine.create({
      patientId: patient._id,
      deviceId: device._id,
      name,
      category,
      compartment: compNum,
      scheduledTime,
      repeatIntervalMinutes: Number(repeatIntervalMinutes) || 5,
      deadlineTime,
      startDate: effectiveStartDate,
      endDate: endDate || '',
      frequency: frequency || 'daily',
      daysOfWeek: daysOfWeek || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      notes: notes || '',
      isActive: true
    });

    // Generate today's DoseInstance only when the date range and selected weekday include today.
    const patientTimezone = patient.timezone || 'Asia/Kolkata';
    const todayWeekday = new Intl.DateTimeFormat('en-US', {
      timeZone: patientTimezone,
      weekday: 'short'
    }).format(new Date());
    const dateIsInRange = effectiveStartDate <= todayStr && (!endDate || todayStr <= endDate);
    const weekdayMatches = (frequency || 'daily') !== 'specific_days' || (Array.isArray(daysOfWeek) && daysOfWeek.includes(todayWeekday));
    if (dateIsInRange && weekdayMatches) {
      const scheduledUtc = parseLocalTimeToUtc(todayStr, scheduledTime, patientTimezone);
      let deadlineUtc = parseLocalTimeToUtc(todayStr, deadlineTime, patientTimezone);
      if (deadlineUtc <= scheduledUtc) {
        deadlineUtc = new Date(deadlineUtc.getTime() + 24 * 60 * 60 * 1000);
      }

      await DoseInstance.findOneAndUpdate(
        { medicineId: medicine._id, date: todayStr },
        {
          patientId: patient._id,
          deviceId: device._id,
          scheduledTimeUtc: scheduledUtc,
          deadlineTimeUtc: deadlineUtc,
          status: 'pending'
        },
        { upsert: true, new: true }
      );
    }

    res.status(201).json({
      success: true,
      message: `Medicine "${name}" assigned to Compartment ${compNum} successfully (Starting: ${effectiveStartDate}).`,
      medicine
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing medicine
 */
export async function updateMedicine(req, res, next) {
  try {
    const { id } = req.params;
    const patient = req.patient;

    const medicine = await Medicine.findOne({ _id: id, patientId: patient._id });
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    const {
      name,
      category,
      compartment,
      scheduledTime,
      repeatIntervalMinutes,
      deadlineTime,
      startDate,
      endDate,
      frequency,
      daysOfWeek,
      notes,
      isActive
    } = req.body;

    // If changing compartment, verify the target compartment is free
    if (compartment !== undefined && Number(compartment) !== medicine.compartment) {
      const compNum = Number(compartment);
      if (![1, 2, 3].includes(compNum)) {
        return res.status(400).json({ success: false, message: 'Invalid compartment number.' });
      }

      const existingActive = await Medicine.findOne({
        deviceId: medicine.deviceId,
        compartment: compNum,
        isActive: true,
        _id: { $ne: medicine._id }
      });

      if (existingActive) {
        return res.status(409).json({
          success: false,
          message: `Compartment ${compNum} is already assigned to "${existingActive.name}".`
        });
      }

      medicine.compartment = compNum;
    }

    if (name) medicine.name = name;
    if (category) medicine.category = category;
    if (scheduledTime) medicine.scheduledTime = scheduledTime;
    if (repeatIntervalMinutes !== undefined) medicine.repeatIntervalMinutes = Number(repeatIntervalMinutes);
    if (deadlineTime) medicine.deadlineTime = deadlineTime;
    if (startDate !== undefined) medicine.startDate = startDate;
    if (endDate !== undefined) medicine.endDate = endDate;
    if (frequency) medicine.frequency = frequency;
    if (daysOfWeek !== undefined) medicine.daysOfWeek = daysOfWeek;
    if (notes !== undefined) medicine.notes = notes;
    if (isActive !== undefined) medicine.isActive = Boolean(isActive);

    await medicine.save();

    // If active and schedule changed, update today's pending dose only when today is scheduled.
    if (medicine.isActive) {
      const timezone = patient.timezone || 'Asia/Kolkata';
      const todayStr = getLocalDateString(timezone);
      const todayWeekday = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short'
      }).format(new Date());
      const dateIsInRange = (!medicine.startDate || todayStr >= medicine.startDate) && (!medicine.endDate || todayStr <= medicine.endDate);
      const weekdayMatches = medicine.frequency !== 'specific_days' || medicine.daysOfWeek.includes(todayWeekday);

      if (dateIsInRange && weekdayMatches) {
        const scheduledUtc = parseLocalTimeToUtc(todayStr, medicine.scheduledTime, timezone);
        let deadlineUtc = parseLocalTimeToUtc(todayStr, medicine.deadlineTime, timezone);
        if (deadlineUtc <= scheduledUtc) deadlineUtc = new Date(deadlineUtc.getTime() + 24 * 60 * 60 * 1000);
        await DoseInstance.findOneAndUpdate(
          { medicineId: medicine._id, date: todayStr, status: 'pending' },
          { scheduledTimeUtc: scheduledUtc, deadlineTimeUtc: deadlineUtc }
        );
      } else {
        await DoseInstance.deleteOne({ medicineId: medicine._id, date: todayStr, status: 'pending' });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Medicine updated successfully.',
      medicine
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete or Deactivate a medicine
 */
export async function deleteMedicine(req, res, next) {
  try {
    const { id } = req.params;
    const patient = req.patient;

    const medicine = await Medicine.findOne({ _id: id, patientId: patient._id });
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    // Deactivate rather than hard delete to preserve historical dose records
    medicine.isActive = false;
    await medicine.save();

    res.status(200).json({
      success: true,
      message: `Medicine "${medicine.name}" deactivated. Compartment ${medicine.compartment} is now free.`,
      medicine
    });
  } catch (error) {
    next(error);
  }
}
