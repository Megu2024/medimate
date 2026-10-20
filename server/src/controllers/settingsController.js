import { Settings } from '../models/Settings.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { encrypt, maskKey, decrypt } from '../utils/encryption.js';
import { config } from '../config/env.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendSmsNotification, sendPushNotification } from '../services/notificationService.js';

/**
 * Get caregiver settings
 * GET /api/settings
 */
export async function getSettings(req, res, next) {
  try {
    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) {
      settings = await Settings.create({
        userId: req.user._id,
        smsRecipientNumber: req.user.phoneNumber || ''
      });
    }

    res.status(200).json({
      success: true,
      settings: {
        hasCustomGeminiKey: settings.hasCustomGeminiKey,
        geminiKeyMasked: settings.geminiKeyMasked,
        hasSystemGeminiKey: Boolean(config.geminiApiKey),
        smsEnabled: settings.smsEnabled,
        smsRecipientNumber: settings.smsRecipientNumber,
        isSmsProviderConfigured: Boolean(
          config.twilio.accountSid && config.twilio.authToken && config.twilio.phoneNumber
        ),
        pushEnabled: settings.pushEnabled,
        hasPushSubscription: (settings.pushSubscriptions?.length || 0) > 0,
        vapidPublicKey: config.vapid.publicKey
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save / Update private Gemini API key
 * POST /api/settings/gemini-key
 */
export async function saveGeminiKey(req, res, next) {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Gemini API key.'
      });
    }

    const trimmedKey = apiKey.trim();

    // Verify key works with a lightweight prompt
    try {
      const genAI = new GoogleGenerativeAI(trimmedKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      await model.generateContent('ping');
    } catch (testErr) {
      return res.status(400).json({
        success: false,
        message: `Key validation failed with Gemini API: ${testErr.message}`
      });
    }

    // Encrypt key
    const encrypted = encrypt(trimmedKey);
    const masked = maskKey(trimmedKey);

    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) {
      settings = new Settings({ userId: req.user._id });
    }

    settings.encryptedGeminiKey = encrypted;
    settings.hasCustomGeminiKey = true;
    settings.geminiKeyMasked = masked;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Gemini API key encrypted and saved securely.',
      geminiKeyMasked: masked,
      hasCustomGeminiKey: true
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete custom Gemini key
 * DELETE /api/settings/gemini-key
 */
export async function deleteGeminiKey(req, res, next) {
  try {
    const settings = await Settings.findOne({ userId: req.user._id });
    if (settings) {
      settings.encryptedGeminiKey = null;
      settings.hasCustomGeminiKey = false;
      settings.geminiKeyMasked = null;
      await settings.save();
    }

    res.status(200).json({
      success: true,
      message: 'Custom Gemini key removed.',
      hasSystemFallback: Boolean(config.geminiApiKey)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update SMS & Push configuration
 * PATCH /api/settings
 */
export async function updateNotificationSettings(req, res, next) {
  try {
    const { smsEnabled, smsRecipientNumber, pushEnabled } = req.body;

    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) {
      settings = new Settings({ userId: req.user._id });
    }

    if (smsEnabled !== undefined) settings.smsEnabled = Boolean(smsEnabled);
    if (smsRecipientNumber !== undefined) settings.smsRecipientNumber = smsRecipientNumber;
    if (pushEnabled !== undefined) settings.pushEnabled = Boolean(pushEnabled);

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully.',
      settings: {
        smsEnabled: settings.smsEnabled,
        smsRecipientNumber: settings.smsRecipientNumber,
        pushEnabled: settings.pushEnabled
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Register a Web Push subscription
 * POST /api/settings/push-subscribe
 */
export async function registerPushSubscription(req, res, next) {
  try {
    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object.' });
    }

    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) {
      settings = new Settings({ userId: req.user._id });
    }

    // Add subscription if not already present
    const exists = settings.pushSubscriptions.some((s) => s.endpoint === subscription.endpoint);
    if (!exists) {
      settings.pushSubscriptions.push(subscription);
    }
    settings.pushEnabled = true;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Browser push notification subscription registered successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send test SMS or Push
 * POST /api/settings/test-notification
 */
export async function sendTestNotification(req, res, next) {
  try {
    const { channel } = req.body; // 'sms' | 'push'
    const settings = await Settings.findOne({ userId: req.user._id });
    const patient = req.patient;

    if (channel === 'sms') {
      const recipient = settings?.smsRecipientNumber || req.user.phoneNumber;
      if (!recipient) {
        return res.status(400).json({
          success: false,
          message: 'No recipient phone number configured for SMS.'
        });
      }

      const result = await sendSmsNotification({
        userId: req.user._id,
        patientId: patient?._id,
        doseId: null,
        recipient,
        message: 'MediMate Test Alert: Smart Medicine Box notification system is active.',
        notificationType: 'system_alert'
      });

      return res.status(200).json({
        success: true,
        message: result.status === 'sent'
          ? 'Test SMS sent successfully!'
          : `SMS logged with status: ${result.status}`,
        log: result
      });
    } else if (channel === 'push') {
      if (!settings?.pushSubscriptions?.length) {
        return res.status(400).json({
          success: false,
          message: 'No active browser push subscription found. Please enable push notifications first.'
        });
      }

      const result = await sendPushNotification({
        userId: req.user._id,
        patientId: patient?._id,
        doseId: null,
        subscriptions: settings.pushSubscriptions,
        title: 'MediMate System Test',
        body: 'Browser push notifications are working properly.',
        notificationType: 'system_alert'
      });

      return res.status(200).json({
        success: true,
        message: 'Push notification test dispatched.',
        log: result
      });
    }

    res.status(400).json({ success: false, message: 'Invalid channel specified.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Get notification logs
 * GET /api/notifications
 */
export async function getNotificationLogs(req, res, next) {
  try {
    const logs = await NotificationLog.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    next(error);
  }
}
