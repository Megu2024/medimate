import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Upload,
  Calendar,
  CheckCircle,
  AlertCircle,
  Save,
  Clock,
  Sparkles
} from 'lucide-react';

export default function ProfilePage() {
  const { user, patient, updatePatientState, refreshUser } = useAuth();

  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [relationship, setRelationship] = useState('Mother');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [medicalNotes, setMedicalNotes] = useState('');

  const [dynamicAge, setDynamicAge] = useState(0);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate age dynamically from DOB string
  const calculateAge = (dobString) => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  useEffect(() => {
    if (user) {
      setCaregiverName(user.fullName || '');
      setCaregiverPhone(user.phoneNumber || '');
    }
    if (patient) {
      setPatientName(patient.name || '');
      if (patient.dateOfBirth) {
        const d = new Date(patient.dateOfBirth);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const formattedDob = `${yyyy}-${mm}-${dd}`;
        setPatientDob(formattedDob);
        setDynamicAge(calculateAge(formattedDob));
      }
      setRelationship(patient.relationship || 'Mother');
      setTimezone(patient.timezone || 'Asia/Kolkata');
      setMedicalNotes(patient.medicalNotes || '');
      setPhotoPreview(patient.photoUrl || null);
    }
  }, [user, patient]);

  const handleDobChange = (e) => {
    const val = e.target.value;
    setPatientDob(val);
    setDynamicAge(calculateAge(val));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.patch('/patients/me', {
        caregiverName,
        caregiverPhone,
        patientName,
        patientDob,
        relationship,
        timezone,
        medicalNotes
      });

      if (res.data.success) {
        setSuccessMsg('Profile and patient details updated successfully.');
        updatePatientState(res.data.patient);
        refreshUser();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    setPhotoFile(selected);
    setPhotoPreview(URL.createObjectURL(selected));
    setUploadingPhoto(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('photo', selected);

      const res = await api.post('/patients/me/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setSuccessMsg('Patient profile photo updated successfully.');
        setPhotoPreview(res.data.photoUrl);
        updatePatientState({ ...patient, photoUrl: res.data.photoUrl });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Update Profile & Patient
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Update caregiver contact details and patient medical profile. Age is dynamically derived from Date of Birth.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Profile Photo Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4">Patient Profile Photo</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Patient Profile"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-sky-200 shadow-xs"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-slate-200 text-slate-400 flex items-center justify-center font-bold text-2xl">
                {patientName?.charAt(0) || 'P'}
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center text-xs font-bold text-sky-600">
                Uploading...
              </div>
            )}
          </div>

          <div className="space-y-2 text-center sm:text-left">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200 cursor-pointer transition-colors shadow-2xs">
              <Upload className="w-4 h-4" />
              <span>{uploadingPhoto ? 'Uploading...' : 'Upload New Photo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-slate-400">
              Supported: JPG, PNG, WEBP (Max 5MB). Photo is stored privately.
            </p>
          </div>
        </div>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Patient Details Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            Patient Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Patient's Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Relationship to Caregiver
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500"
              >
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
                <option value="Spouse">Spouse</option>
                <option value="Grandmother">Grandmother</option>
                <option value="Grandfather">Grandfather</option>
                <option value="Other">Other Family Member</option>
              </select>
            </div>

            {/* Date of Birth & Live Calculated Age */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                Date of Birth <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={patientDob}
                onChange={handleDobChange}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Automatically Derived Age
              </label>
              <div className="px-3.5 py-2 text-xs rounded-xl bg-sky-50 border border-sky-100 font-bold text-sky-900 flex items-center justify-between">
                <span>{dynamicAge} years old</span>
                <span className="text-[10px] text-sky-600 font-medium">Computed from DOB</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Patient Local Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              General Medical Notes & Allergies
            </label>
            <textarea
              rows="3"
              placeholder="e.g. Diabetics type 2, mild hypertension, allergic to penicillin"
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500"
            />
          </div>
        </div>

        {/* Caregiver Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            Caregiver Account
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Caregiver Name
              </label>
              <input
                type="text"
                required
                value={caregiverName}
                onChange={(e) => setCaregiverName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Caregiver Mobile Phone Number
              </label>
              <input
                type="tel"
                value={caregiverPhone}
                onChange={(e) => setCaregiverPhone(e.target.value)}
                placeholder="+91..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-sky-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
