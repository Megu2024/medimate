import mongoose from 'mongoose';

const medicalReportSchema = new mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    originalFileName: {
      type: String,
      required: true
    },
    storedFileName: {
      type: String,
      required: true
    },
    fileMimeType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    hasAnalysis: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const MedicalReport = mongoose.model('MedicalReport', medicalReportSchema);
