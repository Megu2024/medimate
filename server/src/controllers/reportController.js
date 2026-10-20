import path from 'path';
import fs from 'fs';
import { MedicalReport } from '../models/MedicalReport.js';
import { MedicalAnalysis } from '../models/MedicalAnalysis.js';
import { analyzeMedicalReport } from '../services/geminiService.js';

/**
 * Upload a new medical report
 * POST /api/reports
 */
export async function uploadReport(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a file to upload (PDF, PNG, JPG, or WEBP).'
      });
    }

    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const report = await MedicalReport.create({
      caregiverId: req.user._id,
      patientId: patient._id,
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      fileMimeType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path
    });

    res.status(201).json({
      success: true,
      message: 'Medical report uploaded successfully.',
      report: {
        id: report._id,
        originalFileName: report.originalFileName,
        fileMimeType: report.fileMimeType,
        fileSize: report.fileSize,
        uploadedAt: report.createdAt,
        hasAnalysis: false
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all reports for the current caregiver
 * GET /api/reports
 */
export async function getReports(req, res, next) {
  try {
    const patient = req.patient;
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const reports = await MedicalReport.find({
      caregiverId: req.user._id,
      patientId: patient._id
    }).sort({ createdAt: -1 });

    // Fetch existing analyses for these reports
    const reportIds = reports.map((r) => r._id);
    const analyses = await MedicalAnalysis.find({ reportId: { $in: reportIds } });

    const reportsWithAnalyses = reports.map((report) => {
      const analysis = analyses.find((a) => a.reportId.toString() === report._id.toString());
      return {
        id: report._id,
        originalFileName: report.originalFileName,
        fileMimeType: report.fileMimeType,
        fileSize: report.fileSize,
        uploadedAt: report.createdAt,
        hasAnalysis: Boolean(analysis),
        analysis: analysis
          ? {
              id: analysis._id,
              language: analysis.language,
              summary: analysis.summary,
              testsExplanation: analysis.testsExplanation,
              abnormalFindings: analysis.abnormalFindings,
              plainLanguageMeaning: analysis.plainLanguageMeaning,
              doctorQuestions: analysis.doctorQuestions,
              limitationsAndUrgency: analysis.limitationsAndUrgency,
              createdAt: analysis.createdAt
            }
          : null
      };
    });

    res.status(200).json({
      success: true,
      reports: reportsWithAnalyses
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Analyze an uploaded medical report using Google Gemini
 * POST /api/reports/:id/analyze
 */
export async function runReportAnalysis(req, res, next) {
  try {
    const { id } = req.params;
    const { language = 'English' } = req.body;

    const report = await MedicalReport.findOne({
      _id: id,
      caregiverId: req.user._id
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found or unauthorized.' });
    }

    if (!fs.existsSync(report.filePath)) {
      return res.status(404).json({ success: false, message: 'Report file is missing from storage.' });
    }

    // Call Gemini Service
    const analysisResult = await analyzeMedicalReport({
      filePath: report.filePath,
      mimeType: report.fileMimeType,
      language,
      userId: req.user._id
    });

    const parsedData = analysisResult.data;

    // Save or update analysis
    let analysis = await MedicalAnalysis.findOne({ reportId: report._id });
    if (!analysis) {
      analysis = new MedicalAnalysis({
        reportId: report._id,
        caregiverId: req.user._id
      });
    }

    analysis.language = language;
    analysis.summary = parsedData.summary;
    analysis.testsExplanation = parsedData.testsExplanation;
    analysis.abnormalFindings = parsedData.abnormalFindings;
    analysis.plainLanguageMeaning = parsedData.plainLanguageMeaning;
    analysis.doctorQuestions = Array.isArray(parsedData.doctorQuestions)
      ? parsedData.doctorQuestions
      : [parsedData.doctorQuestions];
    analysis.limitationsAndUrgency = parsedData.limitationsAndUrgency;
    analysis.modelUsed = analysisResult.modelUsed;

    await analysis.save();

    report.hasAnalysis = true;
    await report.save();

    res.status(200).json({
      success: true,
      message: `Medical report analyzed successfully in ${language}.`,
      analysis: {
        id: analysis._id,
        language: analysis.language,
        summary: analysis.summary,
        testsExplanation: analysis.testsExplanation,
        abnormalFindings: analysis.abnormalFindings,
        plainLanguageMeaning: analysis.plainLanguageMeaning,
        doctorQuestions: analysis.doctorQuestions,
        limitationsAndUrgency: analysis.limitationsAndUrgency,
        modelUsed: analysis.modelUsed,
        createdAt: analysis.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a report and its analysis
 * DELETE /api/reports/:id
 */
export async function deleteReport(req, res, next) {
  try {
    const { id } = req.params;

    const report = await MedicalReport.findOne({
      _id: id,
      caregiverId: req.user._id
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    // Delete file from disk
    if (fs.existsSync(report.filePath)) {
      try {
        fs.unlinkSync(report.filePath);
      } catch (err) {
        console.error('[Report Delete File Error]:', err.message);
      }
    }

    await MedicalAnalysis.deleteMany({ reportId: report._id });
    await MedicalReport.findByIdAndDelete(report._id);

    res.status(200).json({
      success: true,
      message: 'Medical report and associated analysis removed successfully.'
    });
  } catch (error) {
    next(error);
  }
}
