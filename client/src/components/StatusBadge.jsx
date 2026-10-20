import React from 'react';

export default function StatusBadge({ status, label, size = 'md' }) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20',
    red: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20',
    orange: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-500/20',
    grey: 'bg-slate-100 text-slate-600 border-slate-200 ring-slate-500/10',
    blue: 'bg-sky-50 text-sky-700 border-sky-200 ring-sky-500/20'
  };

  const dotColors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500 animate-pulse',
    red: 'bg-rose-500',
    orange: 'bg-orange-500 animate-pulse',
    grey: 'bg-slate-400',
    blue: 'bg-sky-500'
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-medium'
  };

  const currentStyle = styles[status] || styles.grey;
  const currentDot = dotColors[status] || dotColors.grey;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-xs ring-1 ${currentStyle} ${sizeClasses[size]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${currentDot}`} />
      {label}
    </span>
  );
}
