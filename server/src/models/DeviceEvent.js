import mongoose from 'mongoose';

const deviceEventSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
      index: true
    },
    // Unique event ID from ESP32 for deduplication
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    // DS3231 RTC timestamp recorded when the physical lid transitioned
    deviceTimestamp: {
      type: Date,
      required: true,
      index: true
    },
    serverTimestamp: {
      type: Date,
      default: Date.now
    },
    compartment: {
      type: Number,
      required: true,
      enum: [1, 2, 3]
    },
    lidState: {
      type: String,
      required: true,
      enum: ['open', 'closed']
    },
    eventType: {
      type: String,
      enum: ['normal_access', 'wrong_access', 'unscheduled_access', 'lid_closed'],
      required: true,
      index: true
    },
    doseInstanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoseInstance',
      default: null
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      default: null
    },
    isBufferedUpload: {
      type: Boolean,
      default: false
    },
    processed: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const DeviceEvent = mongoose.model('DeviceEvent', deviceEventSchema);
