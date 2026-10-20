import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import CompartmentCard from '../components/CompartmentCard';
import MedicineModal from '../components/MedicineModal';
import StatusBadge from '../components/StatusBadge';
import {
  Pill,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  User,
  Plus,
  RefreshCw,
  FileText,
  Activity,
  History,
  Calendar
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCompartment, setSelectedCompartment] = useState(null);

  const { socket, onDashboardUpdate, lastEvent } = useSocket();

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    // Listen to real-time socket events
    const cleanup = onDashboardUpdate ? onDashboardUpdate(() => fetchDashboard()) : null;

    // Periodic poll every 30 seconds as reliable fallback
    const interval = setInterval(fetchDashboard, 30000);

    return () => {
      if (cleanup) cleanup();
      clearInterval(interval);
    };
  }, [socket]);

  // If lastEvent changes, refresh dashboard
  useEffect(() => {
    if (lastEvent) {
      fetchDashboard();
    }
  }, [lastEvent]);

  const handleConfigureCompartment = (compNum) => {
    setSelectedCompartment(compNum);
    setModalOpen(true);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Connecting to smart medicine box...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const { patient, device, summary, compartmentCards, recentEvents } = data || {};

  return (
    <div className="space-y-6">
      {/* Top Banner: Patient Overview & Device Status */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Patient Profile Snapshot */}
          <div className="flex items-center gap-4">
            {patient?.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={patient.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-sky-100 shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-linear-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center text-2xl font-extrabold shadow-xs">
                {patient?.name?.charAt(0) || 'P'}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {patient?.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                  {patient?.relationship || 'Family Member'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Age: <span className="font-semibold text-slate-800">{patient?.age} years</span> • Timezone: {patient?.timezone}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  to="/profile"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                >
                  Edit Patient Details & Photo →
                </Link>
              </div>
            </div>
          </div>

          {/* ESP32 Hardware Status Card */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                device?.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {device?.isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">{device?.deviceName || 'Smart Medicine Box'}</span>
                <StatusBadge
                  status={device?.isOnline ? 'green' : 'grey'}
                  label={device?.isOnline ? 'ESP32 Online' : 'ESP32 Offline'}
                  size="sm"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ID: <code className="font-mono text-slate-600 font-semibold">{device?.deviceId}</code>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Last Heartbeat: <span className="font-medium text-slate-700">{device?.lastHeartbeatFormatted}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Configured */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Active Medicines</span>
            <Pill className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900">{summary?.totalConfigured || 0}</span>
            <span className="text-xs text-slate-400 font-medium">/ 3 compartments</span>
          </div>
        </div>

        {/* Scheduled Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Scheduled Today</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900">{summary?.dosesScheduledToday || 0}</span>
            <span className="text-xs text-slate-400 font-medium">doses</span>
          </div>
        </div>

        {/* Accessed Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Doses Taken</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-emerald-600">{summary?.dosesAccessedToday || 0}</span>
            <span className="text-xs text-slate-400 font-medium">completed</span>
          </div>
        </div>

        {/* Missed Doses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Missed Doses</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-extrabold ${summary?.missedDosesToday > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {summary?.missedDosesToday || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">alerted</span>
          </div>
        </div>

        {/* Upcoming Reminder */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-linear-to-br from-sky-50 to-teal-50/50 p-5 rounded-2xl border border-sky-100 shadow-2xs">
          <div className="flex items-center justify-between text-sky-700 mb-2">
            <span className="text-xs font-bold text-sky-800">Next Due Dose</span>
            <Activity className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-sm font-extrabold text-sky-950 truncate">{summary?.upcomingMedicine}</p>
          <p className="text-xs font-semibold text-sky-700 mt-0.5">{summary?.upcomingTime}</p>
        </div>
      </div>

      {/* Main Section: The 3 Physical Box Compartments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-extrabold text-slate-900">Physical Box Compartments</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>Today: {data?.todayDateFormatted || new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status synchronized with ESP32 reed switches and DS3231 RTC
            </p>
          </div>
          {summary?.totalConfigured < 3 && (
            <button
              onClick={() => {
                setSelectedCompartment(null);
                setModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medicine</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {compartmentCards?.map((card) => (
            <CompartmentCard
              key={card.compartment}
              cardData={card}
              onConfigure={handleConfigureCompartment}
            />
          ))}
        </div>
      </div>

      {/* Bottom Row: Recent Lid Events & Quick Healthcare Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Device Events */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Box Sensor Events</h3>
            </div>
            <Link
              to="/history"
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
            >
              View Full History →
            </Link>
          </div>

          {recentEvents?.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No lid sensor events recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentEvents?.map((evt) => (
                <div key={evt.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        evt.eventType === 'normal_access'
                          ? 'bg-emerald-500'
                          : evt.eventType === 'wrong_access'
                          ? 'bg-orange-500'
                          : evt.eventType === 'lid_closed'
                          ? 'bg-sky-400'
                          : 'bg-slate-400'
                      }`}
                    />
                    <div>
                      <span className="font-semibold text-slate-800">
                        Compartment {evt.compartment} ({evt.lidState.toUpperCase()})
                      </span>
                      {evt.medicineName && (
                        <span className="text-slate-500 ml-1.5">— {evt.medicineName}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={
                        evt.eventType === 'normal_access'
                          ? 'green'
                          : evt.eventType === 'wrong_access'
                          ? 'orange'
                          : 'grey'
                      }
                      label={
                        evt.eventType === 'normal_access'
                          ? 'Correct Lid'
                          : evt.eventType === 'wrong_access'
                          ? 'Wrong Lid Warning'
                          : evt.eventType === 'lid_closed'
                          ? 'Lid Closed'
                          : 'Unscheduled'
                      }
                      size="sm"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">{evt.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Medical Report Action Card */}
        <div className="bg-linear-to-br from-teal-500/10 via-sky-500/10 to-transparent p-6 rounded-2xl border border-teal-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center mb-3 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">AI Medical Report Analysis</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Upload {patient?.name}'s recent blood test or lab report. Google Gemini explains all test values in ordinary language (Tamil, Telugu, Hindi, English, etc.).
            </p>
          </div>
          <Link
            to="/reports"
            className="mt-6 w-full py-2.5 px-4 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2"
          >
            <span>Analyze Medical Report →</span>
          </Link>
        </div>
      </div>

      {/* Add / Edit Medicine Modal */}
      <MedicineModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCompartment(null);
        }}
        onSaved={fetchDashboard}
        preselectedCompartment={selectedCompartment}
      />
    </div>
  );
}
