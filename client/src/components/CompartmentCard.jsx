import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, XCircle, Box, BellRing, Calendar } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function CompartmentCard({ cardData, onConfigure }) {
  const {
    compartment,
    isConfigured,
    medicine,
    status,
    statusLabel,
    message,
    eventTime
  } = cardData;

  // Theme borders & tints based on status
  const cardThemes = {
    green: {
      card: 'border-emerald-200 bg-linear-to-b from-white to-emerald-50/30 hover:border-emerald-300',
      badge: 'green',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      accentBg: 'bg-emerald-100/70 text-emerald-800'
    },
    amber: {
      card: 'border-amber-200 bg-linear-to-b from-white to-amber-50/30 hover:border-amber-300',
      badge: 'amber',
      icon: <Clock className="w-5 h-5 text-amber-600 animate-pulse" />,
      accentBg: 'bg-amber-100/70 text-amber-800'
    },
    red: {
      card: 'border-rose-300 bg-linear-to-b from-white to-rose-50/40 hover:border-rose-400 ring-1 ring-rose-200',
      badge: 'red',
      icon: <XCircle className="w-5 h-5 text-rose-600" />,
      accentBg: 'bg-rose-100/80 text-rose-800'
    },
    orange: {
      card: 'border-orange-300 bg-linear-to-b from-white to-orange-50/40 hover:border-orange-400 ring-1 ring-orange-200',
      badge: 'orange',
      icon: <AlertTriangle className="w-5 h-5 text-orange-600 animate-bounce" />,
      accentBg: 'bg-orange-100/80 text-orange-800'
    },
    grey: {
      card: 'border-slate-200 bg-slate-50/60 border-dashed text-slate-400',
      badge: 'grey',
      icon: <Box className="w-5 h-5 text-slate-400" />,
      accentBg: 'bg-slate-200/60 text-slate-600'
    }
  };

  const theme = cardThemes[status] || cardThemes.grey;

  if (!isConfigured) {
    return (
      <div className={`rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 ${theme.card}`}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-600">
              Compartment {compartment}
            </span>
            <StatusBadge status="grey" label="Unassigned" />
          </div>

          <div className="py-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
              <Box className="w-6 h-6" />
            </div>
            <h3 className="text-base font-medium text-slate-700">Empty Compartment</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              No medicine has been assigned to Compartment {compartment} yet.
            </p>
          </div>
        </div>

        <button
          onClick={() => onConfigure && onConfigure(compartment)}
          className="w-full mt-4 py-2.5 px-4 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors border border-sky-200 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Assign Medicine to Compartment {compartment}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col justify-between shadow-xs transition-all duration-200 relative overflow-hidden ${theme.card}`}
    >
      {/* Status bar accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${
          status === 'green'
            ? 'bg-emerald-500'
            : status === 'red'
            ? 'bg-rose-500'
            : status === 'orange'
            ? 'bg-orange-500'
            : 'bg-amber-500'
        }`}
      />

      <div>
        {/* Header: Compartment & Status Pill */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-white shadow-xs">
              Compartment {compartment}
            </span>
            <span className="text-xs font-medium text-slate-500 px-2 py-0.5 rounded-md bg-white border border-slate-200">
              {medicine.category}
            </span>
          </div>
          <StatusBadge status={theme.badge} label={statusLabel} />
        </div>

        {/* Medicine Name */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">{medicine.name}</h3>
            {theme.icon}
          </div>
          {medicine.notes && (
            <p className="text-xs text-slate-500 mt-1 italic line-clamp-1">"{medicine.notes}"</p>
          )}
        </div>

        {/* Schedule Timing Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-white/80 rounded-xl border border-slate-100 text-xs shadow-2xs">
          <div>
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sky-500" />
              Today's Scheduled Time
            </span>
            <span className="font-semibold text-slate-800 text-sm">{medicine.scheduledTime}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Final Deadline</span>
            <span className="font-semibold text-slate-800 text-sm text-rose-600">
              {medicine.deadlineTime}
            </span>
          </div>
          <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500 text-[11px]">
            <span className="flex items-center gap-1">
              <BellRing className="w-3.5 h-3.5 text-slate-400" />
              Repeats every {medicine.repeatIntervalMinutes} mins
            </span>
            {eventTime && (
              <span className="text-emerald-700 font-medium">Accessed: {eventTime}</span>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Status / Alert Message */}
      <div
        className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2.5 ${
          status === 'green'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : status === 'red'
            ? 'bg-rose-50 text-rose-800 border-rose-200 font-semibold'
            : status === 'orange'
            ? 'bg-orange-50 text-orange-900 border-orange-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}
      >
        <span className="mt-0.5 shrink-0">{theme.icon}</span>
        <span className="leading-snug">{message}</span>
      </div>
    </div>
  );
}
