import mongoose from 'mongoose';

const medicalAnalysisSchema = new mongoose.Schema(
  {
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalReport',
      required: true,
      index: true
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    language: {
      type: String,
      required: true,
      default: 'English'
    },
    // The 6 required structured medical explanation sections
    summary: {
      type: String,
      required: true
    },
    testsExplanation: {
      type: String,
      required: true
    },
    abnormalFindings: {
      type: String,
      required: true
    },
    plainLanguageMeaning: {
      type: String,
      required: true
    },
    doctorQuestions: {
      type: [String],
      default: []
    },
    limitationsAndUrgency: {
      type: String,
      required: true
    },
    rawExtractedText: {
      type: String,
      select: false // Exclude by default for performance & privacy
    },
    modelUsed: {
      type: String,
      default: 'gemini-3.5-flash'
    }
  },
  {
    timestamps: true
  }
);

export const MedicalAnalysis = mongoose.model('MedicalAnalysis', medicalAnalysisSchema);
