import { Device } from '../models/Device.js';
import { Medicine } from '../models/Medicine.js';
import { Patient } from '../models/Patient.js';
import { processDeviceEvent } from '../services/eventProcessor.js';

/**
 * ESP32 Heartbeat endpoint
 * POST /api/device-api/heartbeat
 */
export async function deviceHeartbeat(req, res, next) {
  try {
    const device = req.device;
    const { firmwareVersion, wifiRssi, ipAddress } = req.body;

    device.lastHeartbeat = new Date();
    if (firmwareVersion) device.firmwareVersion = firmwareVersion;
    if (wifiRssi !== undefined) device.wifiRssi = wifiRssi;
    if (ipAddress) device.ipAddress = ipAddress;

    await device.save();

    res.status(200).json({
      success: true,
      message: 'Heartbeat acknowledged',
      serverUtc: new Date().toISOString(),
      isConfigSynced: true
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ESP32 Configuration Download
 * GET /api/device-api/config
 */
export async function getDeviceConfig(req, res, next) {
  try {
    const device = req.device;
    const patient = await Patient.findById(device.patientId);

    const activeMedicines = await Medicine.find({
      deviceId: device._id,
      isActive: true
    }).select('name category compartment scheduledTime repeatIntervalMinutes deadlineTime notes startDate endDate frequency daysOfWeek');

    device.lastSyncTime = new Date();
    await device.save();

    res.status(200).json({
      success: true,
      deviceId: device.deviceId,
      patientName: patient?.name || 'Patient',
      timezone: patient?.timezone || 'Asia/Kolkata',
      serverUtc: new Date().toISOString(),
      syncIntervalSeconds: 60,
      medicines: activeMedicines.map((m) => ({
        id: m._id,
        name: m.name,
        category: m.category,
        compartment: m.compartment,
        scheduledTime: m.scheduledTime, // "08:00"
        repeatIntervalMinutes: m.repeatIntervalMinutes,
        deadlineTime: m.deadlineTime, // "08:30"
        startDate: m.startDate || '',
        endDate: m.endDate || '',
        frequency: m.frequency || 'daily',
        daysOfWeek: m.daysOfWeek || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ESP32 Event Upload (Single or Batch for buffered offline events)
 * POST /api/device-api/events
 */
export async function uploadDeviceEvents(req, res, next) {
  try {
    const device = req.device;
    let events = [];

    if (Array.isArray(req.body.events)) {
      events = req.body.events;
    } else if (req.body.eventId) {
      events = [req.body];
    } else {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PAYLOAD',
        message: 'Must provide an event object with eventId or an array of events'
      });
    }

    const processedResults = [];

    for (const evt of events) {
      const { eventId, timestamp, compartment, lidState, isBuffered } = evt;

      if (!eventId || !compartment || !lidState) {
        continue;
      }

      const result = await processDeviceEvent({
        device,
        eventId,
        deviceTimestamp: timestamp ? new Date(timestamp) : new Date(),
        compartment: Number(compartment),
        lidState,
        isBuffered: Boolean(isBuffered)
      });

      // Prepare hardware feedback instructions for OLED & Speaker
      let audioPrompt = '';
      let oledSymbol = 'INFO';
      let oledText = `Compartment ${compartment} ${lidState}`;

      if (lidState === 'open') {
        if (result.eventType === 'normal_access') {
          audioPrompt = `You have opened Compartment ${compartment} for your scheduled medicine. Please follow your prescribed instructions and stay healthy.`;
          oledSymbol = 'CHECK';
          oledText = `Comp ${compartment} accessed`;
        } else if (result.eventType === 'wrong_access') {
          audioPrompt = `This is the wrong compartment for your scheduled medicine. Please use Compartment ${result.expectedCompartment}.`;
          oledSymbol = 'WARN';
          oledText = `Wrong! Use Comp ${result.expectedCompartment}`;
        } else {
          audioPrompt = `Compartment ${compartment} opened outside scheduled dose window.`;
          oledSymbol = 'INFO';
          oledText = `Comp ${compartment} Open`;
        }
      }

      processedResults.push({
        eventId,
        status: 'accepted',
        eventType: result.eventType,
        feedback: {
          audioPrompt,
          oledSymbol,
          oledText
        }
      });
    }

    res.status(200).json({
      success: true,
      processedCount: processedResults.length,
      results: processedResults
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ESP32 Time & Status Sync
 * GET /api/device-api/sync
 */
export async function syncDeviceTime(req, res, next) {
  try {
    const device = req.device;
    device.lastHeartbeat = new Date();
    await device.save();

    res.status(200).json({
      success: true,
      deviceId: device.deviceId,
      serverUtc: new Date().toISOString(),
      timestampUnix: Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    next(error);
  }
}
