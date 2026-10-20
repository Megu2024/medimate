import mongoose from 'mongoose';
import { calculateAge } from '../utils/dateUtils.js';

const patientSchema = new mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Patient date of birth is required']
    },
    relationship: {
      type: String,
      trim: true,
      default: 'Mother'
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true
    },
    photoUrl: {
      type: String,
      default: null
    },
    medicalNotes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual property for dynamically calculated age
patientSchema.virtual('age').get(function () {
  return calculateAge(this.dateOfBirth);
});

export const Patient = mongoose.model('Patient', patientSchema);
