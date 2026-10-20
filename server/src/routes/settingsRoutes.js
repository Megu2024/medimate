import express from 'express';
import {
  getSettings,
  saveGeminiKey,
  deleteGeminiKey,
  updateNotificationSettings,
  registerPushSubscription,
  sendTestNotification,
  getNotificationLogs
} from '../controllers/settingsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getSettings);
router.patch('/', updateNotificationSettings);
router.post('/gemini-key', saveGeminiKey);
router.delete('/gemini-key', deleteGeminiKey);
router.post('/push-subscribe', registerPushSubscription);
router.post('/test-notification', sendTestNotification);
router.get('/notifications', getNotificationLogs);

export default router;
