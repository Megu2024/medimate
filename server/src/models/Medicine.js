import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
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
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Medicine category is required (e.g., Sugar, BP, Cold)'],
      trim: true
    },
    compartment: {
      type: Number,
      required: [true, 'Compartment number is required'],
      enum: [1, 2, 3]
    },
    scheduledTime: {
      type: String,
      required: [true, 'Scheduled time is required (HH:MM 24h format)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Scheduled time must be in HH:MM format']
    },
    repeatIntervalMinutes: {
      type: Number,
      required: true,
      default: 5,
      min: [1, 'Repeat interval must be at least 1 minute'],
      max: [60, 'Repeat interval cannot exceed 60 minutes']
    },
    deadlineTime: {
      type: String,
      required: [true, 'Deadline time is required (HH:MM 24h format)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Deadline time must be in HH:MM format']
    },
    startDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'
    },
    endDate: {
      type: String,
      default: '',
      validate: {
        validator(value) { return !value || /^\d{4}-\d{2}-\d{2}$/.test(value); },
        message: 'End date must use YYYY-MM-DD format.'
      }
    },
    frequency: {
      type: String,
      enum: ['daily', 'specific_days'],
      default: 'daily'
    },
    daysOfWeek: {
      type: [String],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    notes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate active compartment allocation per device
medicineSchema.index(
  { deviceId: 1, compartment: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// Pre-save validation: Check that deadlineTime is after scheduledTime (or wraps past midnight cleanly)
medicineSchema.pre('validate', function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error('Schedule end date must be on or after start date.'));
  }
  if (this.frequency === 'specific_days' && (!Array.isArray(this.daysOfWeek) || this.daysOfWeek.length === 0)) {
    return next(new Error('Select at least one day for a selected-days schedule.'));
  }
  if (this.scheduledTime && this.deadlineTime) {
    const [sH, sM] = this.scheduledTime.split(':').map(Number);
    const [dH, dM] = this.deadlineTime.split(':').map(Number);
    const startMins = sH * 60 + sM;
    let endMins = dH * 60 + dM;
    
    // If deadline is earlier than scheduled time, assume it spans midnight or is invalid
    if (endMins <= startMins) {
      endMins += 24 * 60; // 24 hour shift
    }
    
    if (endMins - startMins < 5) {
      return next(new Error('Deadline must be at least 5 minutes after scheduled time'));
    }
  }
  next();
});

export const Medicine = mongoose.model('Medicine', medicineSchema);
