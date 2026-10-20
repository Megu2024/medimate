import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      index: true
    },
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    deviceName: {
      type: String,
      default: 'Smart Medicine Box',
      trim: true
    },
    // Secret token used by ESP32 in HTTPS Authorization header
    deviceTokenHash: {
      type: String,
      select: false
    },
    // Temporary 6-digit code for user pairing workflow
    pairingCode: {
      type: String,
      trim: true,
      index: true
    },
    pairingCodeExpires: {
      type: Date
    },
    isPaired: {
      type: Boolean,
      default: false,
      index: true
    },
    firmwareVersion: {
      type: String,
      default: '1.0.0'
    },
    lastHeartbeat: {
      type: Date,
      default: null
    },
    lastSyncTime: {
      type: Date,
      default: null
    },
    ipAddress: {
      type: String,
      default: null
    },
    wifiRssi: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for online status (online if heartbeat was received within the last 90 seconds)
deviceSchema.virtual('isOnline').get(function () {
  if (!this.lastHeartbeat) return false;
  const ninetySecondsAgo = new Date(Date.now() - 90 * 1000);
  return this.lastHeartbeat > ninetySecondsAgo;
});

export const Device = mongoose.model('Device', deviceSchema);
