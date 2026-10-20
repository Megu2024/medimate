import React, { useState, useEffect } from 'react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  History,
  Filter,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search
} from 'lucide-react';

export default function DoseHistoryPage() {
  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/dashboard/history', { params });
      if (res.data.success) {
        setDoses(res.data.doses);
        setTotalPages(res.data.pages || 1);
        setTotalCount(res.data.total || 0);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load dose history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, startDate, endDate]);

  const handleResetFilters = () => {
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Dose History & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Complete record of scheduled medicine doses, physical compartment openings, and missed deadlines.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          className="p-2 text-slate-600 hover:text-sky-600 hover:bg-slate-100 rounded-xl transition-colors self-start sm:self-auto cursor-pointer"
          title="Refresh History"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <Filter className="w-4 h-4 text-sky-600" />
          <span>Filter:</span>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus:outline-hidden focus:border-sky-500"
        >
          <option value="">All Statuses</option>
          <option value="accessed">Accessed / Taken</option>
          <option value="missed">Missed Dose</option>
          <option value="wrong_compartment_opened">Wrong Compartment</option>
          <option value="pending">Pending</option>
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus:outline-hidden focus:border-sky-500"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus:outline-hidden focus:border-sky-500"
          />
        </div>

        {(statusFilter || startDate || endDate) && (
          <button
            onClick={handleResetFilters}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline ml-auto cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading && doses.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            Loading history...
          </div>
        ) : doses.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No dose records found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Compartment</th>
                  <th className="py-3 px-4">Scheduled Window</th>
                  <th className="py-3 px-4">Dose Status</th>
                  <th className="py-3 px-4">Lid Access Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doses.map((d) => (
                  <tr key={d._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                      {d.date}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{d.medicineId?.name || 'Unknown'}</span>
                      <span className="text-[11px] text-slate-400">{d.medicineId?.category}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800">
                        Compartment {d.medicineId?.compartment}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {d.medicineId?.scheduledTime} → {d.medicineId?.deadlineTime}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {d.status === 'accessed' ? (
                        <StatusBadge status="green" label="Accessed / Taken" size="sm" />
                      ) : d.status === 'missed' ? (
                        <StatusBadge status="red" label="Missed Dose" size="sm" />
                      ) : d.status === 'wrong_compartment_opened' ? (
                        <StatusBadge status="orange" label={`Wrong (Comp ${d.wrongCompartmentOpened})`} size="sm" />
                      ) : (
                        <StatusBadge status="amber" label="Pending" size="sm" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {d.accessedAt ? (
                        <span className="text-emerald-700 font-semibold">
                          {new Date(d.accessedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : d.status === 'missed' ? (
                        <span className="text-rose-500 font-medium">No access before deadline</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Showing page {page} of {totalPages} ({totalCount} records)</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer font-medium hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer font-medium hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
