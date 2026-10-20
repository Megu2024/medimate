import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  FileText,
  UploadCloud,
  Languages,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Trash2,
  FileCheck,
  RefreshCw,
  Info,
  ChevronDown,
  ExternalLink
} from 'lucide-react';

export default function ReportAnalysisPage() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [activeAnalysis, setActiveAnalysis] = useState(null);

  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('English');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const supportedLanguages = [
    { code: 'English', label: 'English' },
    { code: 'Tamil', label: 'தமிழ் (Tamil)' },
    { code: 'Telugu', label: 'తెలుగు (Telugu)' },
    { code: 'Hindi', label: 'हिन्दी (Hindi)' },
    { code: 'Kannada', label: 'ಕನ್ನಡ (Kannada)' },
    { code: 'Malayalam', label: 'മലയാളം (Malayalam)' },
    { code: 'Bengali', label: 'বাংলা (Bengali)' },
    { code: 'Marathi', label: 'मराठी (Marathi)' },
    { code: 'Gujarati', label: 'ગુજરાતી (Gujarati)' }
  ];

  const fetchReports = async () => {
    try {
      const res = await api.get('/reports');
      if (res.data.success) {
        setReports(res.data.reports);
        if (res.data.reports.length > 0 && !selectedReport) {
          setSelectedReport(res.data.reports[0]);
          setActiveAnalysis(res.data.reports[0].analysis || null);
        } else if (selectedReport) {
          const updated = res.data.reports.find((r) => r.id === selectedReport.id);
          if (updated) {
            setSelectedReport(updated);
            setActiveAnalysis(updated.analysis || null);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUploadAndAnalyze = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF or image medical report to upload.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('report', file);

      const uploadRes = await api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (!uploadRes.data.success) {
        throw new Error(uploadRes.data.message || 'Upload failed');
      }

      const newReportId = uploadRes.data.report.id;
      setUploading(false);
      setAnalyzing(true);

      // Trigger Gemini analysis
      const analyzeRes = await api.post(`/reports/${newReportId}/analyze`, { language });
      if (analyzeRes.data.success) {
        setSuccessMsg(`Report analyzed successfully in ${language}!`);
        setFile(null);
        await fetchReports();
        const fullReport = reports.find((r) => r.id === newReportId);
        if (fullReport) {
          setSelectedReport(fullReport);
        }
        setActiveAnalysis(analyzeRes.data.analysis);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to analyze report.');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleReanalyze = async (reportId, lang) => {
    setAnalyzing(true);
    setError('');
    try {
      const res = await api.post(`/reports/${reportId}/analyze`, { language: lang });
      if (res.data.success) {
        setActiveAnalysis(res.data.analysis);
        setSuccessMsg(`Report re-analyzed in ${lang}!`);
        await fetchReports();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to re-analyze report.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteClick = (report) => {
    setReportToDelete(report);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/reports/${reportToDelete.id}`);
      setDeleteModalOpen(false);
      setReportToDelete(null);
      setSelectedReport(null);
      setActiveAnalysis(null);
      await fetchReports();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete report.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Medical Report Analysis
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-linear-to-r from-teal-500 to-sky-500 text-white flex items-center gap-1 shadow-2xs">
            <Sparkles className="w-3 h-3" />
            Gemini Multimodal AI
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Upload laboratory test reports or blood work. Google Gemini explains all parameters and reference ranges in layman's language.
        </p>
      </div>

      {/* Mandatory AI Medical Disclaimer */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 shadow-2xs">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Important Clinical Notice:</span> This AI medical explanation is for educational and communication purposes only. It is not a clinical diagnosis and cannot alter prescribed medicines. Always consult your doctor or certified healthcare professional for medical decisions.
        </div>
      </div>

      {/* Upload & Language Form Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-sky-600" />
          Upload New Diagnostic Report
        </h2>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <span>{error}</span>
            {error.includes('Settings') && (
              <Link to="/settings" className="font-bold underline text-rose-800 ml-2">
                Open Settings →
              </Link>
            )}
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleUploadAndAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File Dropzone / Input */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Medical File (PDF, PNG, JPG, or WEBP - Max 10MB)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer border border-slate-200 rounded-xl bg-slate-50/50"
                />
              </div>
              {file && (
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-teal-600" />
                Explanation Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-hidden focus:border-teal-500"
              >
                {supportedLanguages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={uploading || analyzing}
              className="px-6 py-2.5 text-xs font-bold text-white bg-linear-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {(uploading || analyzing) && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>
                {uploading
                  ? 'Uploading Report...'
                  : analyzing
                    ? 'Gemini Analyzing Report...'
                    : 'Start AI Report Analysis'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Analysis Display & Report Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Previous Reports List */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs h-fit">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
            <span>Uploaded Reports</span>
            <span className="text-xs text-slate-400 font-normal">{reports.length} files</span>
          </h3>

          {reports.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No reports uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => {
                    setSelectedReport(report);
                    setActiveAnalysis(report.analysis || null);
                  }}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${selectedReport?.id === report.id
                      ? 'bg-sky-50/80 border-sky-300 ring-1 ring-sky-300 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">
                        {report.originalFileName}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(report);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Delete report"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>{new Date(report.uploadedAt).toLocaleDateString()}</span>
                    {report.hasAnalysis ? (
                      <span className="text-teal-600 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Analyzed ({report.analysis?.language})
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium">Pending Analysis</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: The 6-Section Structured AI Analysis */}
        <div className="lg:col-span-2">
          {!selectedReport ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center">
              <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">Select or upload a report</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select an uploaded report on the left or upload a new one to view the structured 6-section breakdown.
              </p>
            </div>
          ) : !activeAnalysis ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
              <FileText className="w-10 h-10 text-sky-500 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-slate-800">{selectedReport.originalFileName}</h3>
                <p className="text-xs text-slate-500 mt-1">This report has not been analyzed yet.</p>
              </div>

              <div className="max-w-xs mx-auto flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  {supportedLanguages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleReanalyze(selectedReport.id, language)}
                  disabled={analyzing}
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors cursor-pointer"
                >
                  {analyzing ? 'Analyzing...' : 'Analyze Now'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              {/* Header with Language badge & Re-analyze toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                      Language: {activeAnalysis.language}
                    </span>
                    <span className="text-xs text-slate-400">
                      Model: {activeAnalysis.modelUsed || 'gemini-3.5-flash'}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                    {selectedReport.originalFileName}
                  </h3>
                </div>

                {/* Change Language dropdown & Reanalyze */}
                <div className="flex items-center gap-2">
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    {supportedLanguages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleReanalyze(selectedReport.id, language)}
                    disabled={analyzing}
                    className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors cursor-pointer border border-teal-200"
                  >
                    {analyzing ? 'Translating...' : 'Translate'}
                  </button>
                </div>
              </div>

              {/* SECTION 1: Summary */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  1. Simple Summary
                </span>
                <p className="text-sm text-slate-800 leading-relaxed font-medium bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  {activeAnalysis.summary}
                </p>
              </div>

              {/* SECTION 2: Tests & Measurements Explanation */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  2. Tests & Parameters Explained
                </span>
                <p className="text-xs text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-slate-200">
                  {activeAnalysis.testsExplanation}
                </p>
              </div>

              {/* SECTION 3: Abnormal Findings / Out of Reference Ranges */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-rose-500 tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  3. Results Outside Stated Reference Ranges
                </span>
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                  {activeAnalysis.abnormalFindings}
                </div>
              </div>

              {/* SECTION 4: Plain Language Meaning */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-sky-600 tracking-wider">
                  4. What These Findings Mean in Ordinary Language
                </span>
                <p className="text-xs text-slate-700 leading-relaxed bg-sky-50/40 p-4 rounded-2xl border border-sky-100">
                  {activeAnalysis.plainLanguageMeaning}
                </p>
              </div>

              {/* SECTION 5: Questions for the Doctor */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-teal-600 tracking-wider flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" />
                  5. Suggested Questions to Ask Your Doctor
                </span>
                <ul className="space-y-2">
                  {activeAnalysis.doctorQuestions?.map((q, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-teal-50/40 border border-teal-100 text-xs text-teal-950 font-medium flex items-start gap-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-teal-200/60 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* SECTION 6: Limitations & Urgency */}
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 space-y-1">
                <span className="font-bold text-slate-900 block">
                  6. Limitations & When Medical Assessment is Needed:
                </span>
                <p className="leading-relaxed">{activeAnalysis.limitationsAndUrgency}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete Medical Report"
        message={`Are you sure you want to permanently delete "${reportToDelete?.originalFileName}" and its AI analysis? This action cannot be undone.`}
        confirmText="Delete Report"
        isDanger={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setReportToDelete(null);
        }}
      />
    </div>
  );
}
