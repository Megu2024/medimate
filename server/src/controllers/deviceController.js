import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Device } from '../models/Device.js';
import { Patient } from '../models/Patient.js';

/**
 * Get device details for the caregiver's patient
 */
export async function getDevice(req, res, next) {
  try {
    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    let device = await Device.findOne({ patientId: patient._id });

    if (!device) {
      // Auto-provision if needed
      const rawToken = crypto.randomBytes(16).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();

      device = await Device.create({
        caregiverId: req.user._id,
        patientId: patient._id,
        deviceId: `MEDIMATE-${Math.floor(1000 + Math.random() * 9000)}`,
        deviceName: `${patient.name}'s Smart Medicine Box`,
        deviceTokenHash: tokenHash,
        pairingCode,
        isPaired: true
      });
    }

    res.status(200).json({
      success: true,
      device: {
        id: device._id,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        isPaired: device.isPaired,
        pairingCode: device.pairingCode,
        firmwareVersion: device.firmwareVersion,
        isOnline: device.isOnline,
        lastHeartbeat: device.lastHeartbeat,
        lastSyncTime: device.lastSyncTime,
        wifiRssi: device.wifiRssi,
        ipAddress: device.ipAddress
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate a new pairing code and secret device token for ESP32 configuration
 */
export async function generateDeviceCredentials(req, res, next) {
  try {
    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    let device = await Device.findOne({ patientId: patient._id });
    if (!device) {
      device = new Device({
        caregiverId: req.user._id,
        patientId: patient._id,
        deviceId: `MEDIMATE-${Math.floor(1000 + Math.random() * 9000)}`,
        deviceName: `${patient.name}'s Smart Medicine Box`
      });
    }

    const rawToken = crypto.randomBytes(16).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();

    device.deviceTokenHash = tokenHash;
    device.pairingCode = pairingCode;
    device.pairingCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    device.isPaired = true;

    await device.save();

    res.status(200).json({
      success: true,
      message: 'New device credentials generated. Use these in the ESP32 config.h file.',
      credentials: {
        deviceId: device.deviceId,
        deviceToken: rawToken, // Displayed once for flashing firmware
        pairingCode: device.pairingCode
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke or unpair a device
 */
export async function revokeDevice(req, res, next) {
  try {
    const patient = req.patient;
    const device = await Device.findOne({ patientId: patient._id });

    if (!device) {
      return res.status(404).json({ success: false, message: 'No device found.' });
    }

    device.isPaired = false;
    device.deviceTokenHash = null;
    await device.save();

    res.status(200).json({
      success: true,
      message: 'Device revoked successfully. It will no longer be able to communicate with the cloud.'
    });
  } catch (error) {
    next(error);
  }
}
