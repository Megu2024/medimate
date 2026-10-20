import twilio from 'twilio';
import webpush from 'web-push';
import { config } from '../config/env.js';
import { NotificationLog } from '../models/NotificationLog.js';

// Initialize WebPush if VAPID keys exist
if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey
  );
}

// Twilio client initialization helper
function getTwilioClient() {
  if (config.twilio.accountSid && config.twilio.authToken && config.twilio.phoneNumber) {
    return twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return null;
}

/**
 * Dispatch SMS Notification
 */
export async function sendSmsNotification({ userId, patientId, doseId, recipient, message, notificationType }) {
  const client = getTwilioClient();

  if (!client) {
    console.log(`[SMS Simulation] To: ${recipient} | Type: ${notificationType} | Msg: ${message}`);
    // Log as unconfigured / simulated so UI is strictly honest
    return await NotificationLog.create({
      userId,
      patientId,
      doseId,
      channel: 'sms',
      notificationType,
      recipient: recipient || 'Not Configured',
      message,
      status: 'provider_unconfigured',
      providerResponse: 'Twilio SMS credentials are not configured in environment. Event logged in audit log.'
    });
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: config.twilio.phoneNumber,
      to: recipient
    });

    return await NotificationLog.create({
      userId,
      patientId,
      doseId,
      channel: 'sms',
      notificationType,
      recipient,
      message,
      status: 'sent',
      providerResponse: `Twilio SID: ${result.sid}`
    });
  } catch (error) {
    console.error('[SMS Delivery Error]:', error.message);
    return await NotificationLog.create({
      userId,
      patientId,
      doseId,
      channel: 'sms',
      notificationType,
      recipient,
      message,
      status: 'failed',
      providerResponse: error.message
    });
  }
}

/**
 * Dispatch Browser Push Notification
 */
export async function sendPushNotification({ userId, patientId, doseId, subscriptions = [], title, body, notificationType }) {
  if (!subscriptions || subscriptions.length === 0) {
    return null;
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/favicon.ico',
    tag: notificationType,
    url: '/dashboard'
  });

  const results = [];
  for (const sub of subscriptions) {
    try {
      if (!config.vapid.publicKey || !config.vapid.privateKey) {
        throw new Error('VAPID keys not configured');
      }
      const response = await webpush.sendNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, status: 'sent' });
    } catch (err) {
      results.push({ endpoint: sub.endpoint, status: 'failed', error: err.message });
    }
  }

  const hasSuccess = results.some((r) => r.status === 'sent');
  return await NotificationLog.create({
    userId,
    patientId,
    doseId,
    channel: 'push',
    notificationType,
    recipient: `Browser Push (${subscriptions.length} devices)`,
    message: `${title}: ${body}`,
    status: hasSuccess ? 'sent' : 'failed',
    providerResponse: JSON.stringify(results)
  });
}
