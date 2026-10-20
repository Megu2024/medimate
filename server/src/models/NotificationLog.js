import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      index: true
    },
    doseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoseInstance',
      index: true
    },
    channel: {
      type: String,
      enum: ['sms', 'push'],
      required: true
    },
    notificationType: {
      type: String,
      enum: ['dose_accessed', 'dose_missed', 'wrong_compartment', 'system_alert'],
      required: true
    },
    recipient: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'simulated', 'provider_unconfigured', 'pending'],
      default: 'pending',
      index: true
    },
    providerResponse: {
      type: String,
      default: ''
    },
    attempts: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
