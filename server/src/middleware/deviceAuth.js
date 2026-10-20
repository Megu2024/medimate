import bcrypt from 'bcryptjs';
import { Device } from '../models/Device.js';

export const protectDevice = async (req, res, next) => {
  try {
    const deviceId = req.headers['x-device-id'] || req.body?.deviceId;
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-device-token']) {
      token = req.headers['x-device-token'];
    }

    if (!deviceId || !token) {
      return res.status(401).json({
        success: false,
        error: 'DEVICE_AUTH_REQUIRED',
        message: 'Missing device credentials (x-device-id or device token)'
      });
    }

    // Look up device including its secret token hash
    const device = await Device.findOne({ deviceId }).select('+deviceTokenHash');

    if (!device) {
      return res.status(401).json({
        success: false,
        error: 'DEVICE_NOT_FOUND',
        message: 'Device is not registered in MediMate'
      });
    }

    if (!device.isPaired) {
      return res.status(403).json({
        success: false,
        error: 'DEVICE_NOT_PAIRED',
        message: 'Device has not been paired with a patient account'
      });
    }

    // Compare token with stored hash
    const isMatch = await bcrypt.compare(token, device.deviceTokenHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_DEVICE_CREDENTIALS',
        message: 'Device authentication token rejected'
      });
    }

    req.device = device;
    next();
  } catch (error) {
    console.error('[Device Auth Error]', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to authenticate device'
    });
  }
};
