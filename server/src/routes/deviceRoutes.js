import express from 'express';
import {
  getDevice,
  generateDeviceCredentials,
  revokeDevice
} from '../controllers/deviceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getDevice);
router.post('/credentials', generateDeviceCredentials);
router.post('/revoke', revokeDevice);

export default router;
