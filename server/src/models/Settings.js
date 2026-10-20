import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    // AES-256-GCM encrypted Gemini API Key
    encryptedGeminiKey: {
      type: String,
      default: null,
      select: false // Do not include in normal queries
    },
    hasCustomGeminiKey: {
      type: Boolean,
      default: false
    },
    geminiKeyMasked: {
      type: String,
      default: null
    },
    smsEnabled: {
      type: Boolean,
      default: false
    },
    smsRecipientNumber: {
      type: String,
      default: ''
    },
    pushEnabled: {
      type: Boolean,
      default: false
    },
    pushSubscriptions: [
      {
        endpoint: String,
        keys: {
          p256dh: String,
          auth: String
        },
        subscribedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

export const Settings = mongoose.model('Settings', settingsSchema);
