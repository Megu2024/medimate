import express from 'express';
import {
  deviceHeartbeat,
  getDeviceConfig,
  uploadDeviceEvents,
  syncDeviceTime
} from '../controllers/deviceApiController.js';
import { protectDevice } from '../middleware/deviceAuth.js';

const router = express.Router();

// Device authentication required for all ESP32 endpoints
router.use(protectDevice);

router.post('/heartbeat', deviceHeartbeat);
router.get('/config', getDeviceConfig);
router.post('/events', uploadDeviceEvents);
router.get('/sync', syncDeviceTime);

export default router;
