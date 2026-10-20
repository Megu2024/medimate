import mongoose from 'mongoose';

const doseInstanceSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
      index: true
    },
    // Local date string 'YYYY-MM-DD'
    date: {
      type: String,
      required: true,
      index: true
    },
    scheduledTimeUtc: {
      type: Date,
      required: true,
      index: true
    },
    deadlineTimeUtc: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accessed', 'missed', 'wrong_compartment_opened'],
      default: 'pending',
      index: true
    },
    qualifyingEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeviceEvent',
      default: null
    },
    accessedAt: {
      type: Date,
      default: null
    },
    wrongCompartmentOpened: {
      type: Number,
      default: null
    },
    wrongCompartmentOpenedAt: {
      type: Date,
      default: null
    },
    missedDoseProcessed: {
      type: Boolean,
      default: false,
      index: true
    },
    smsAlertSent: {
      type: Boolean,
      default: false
    },
    pushAlertSent: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Idempotent: exactly one dose record per medicine per date
doseInstanceSchema.index({ medicineId: 1, date: 1 }, { unique: true });

export const DoseInstance = mongoose.model('DoseInstance', doseInstanceSchema);
