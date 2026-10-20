import React, { useState, useEffect } from 'react';
import { X, Clock, Pill, Bell, AlertCircle, Calendar, Repeat } from 'lucide-react';
import api from '../services/api';

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function MedicineModal({ isOpen, onClose, onSaved, initialData = null, preselectedCompartment = null }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Sugar');
  const [compartment, setCompartment] = useState('');
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [repeatIntervalMinutes, setRepeatIntervalMinutes] = useState(5);
  const [deadlineTime, setDeadlineTime] = useState('08:30');
  const [startDate, setStartDate] = useState(() => getLocalDateInputValue());
  const [endDate, setEndDate] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [daysOfWeek, setDaysOfWeek] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [notes, setNotes] = useState('');

  const [availableCompartments, setAvailableCompartments] = useState([1, 2, 3]);
  const [occupiedCompartments, setOccupiedCompartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available compartments when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchCompartments = async () => {
      try {
        const res = await api.get('/medicines/available-compartments');
        if (res.data.success) {
          setAvailableCompartments(res.data.availableCompartments);
          setOccupiedCompartments(res.data.occupiedCompartments);

          // If editing, current medicine's compartment is valid
          if (initialData) {
            setCompartment(initialData.compartment);
          } else if (preselectedCompartment && res.data.availableCompartments.includes(preselectedCompartment)) {
            setCompartment(preselectedCompartment);
          } else if (res.data.availableCompartments.length > 0) {
            setCompartment(res.data.availableCompartments[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch available compartments:', err);
      }
    };

    fetchCompartments();

    const todayDateString = getLocalDateInputValue();

    if (initialData) {
      setName(initialData.name || '');
      setCategory(initialData.category || 'Sugar');
      setCompartment(initialData.compartment || '');
      setScheduledTime(initialData.scheduledTime || '08:00');
      setRepeatIntervalMinutes(initialData.repeatIntervalMinutes || 5);
      setDeadlineTime(initialData.deadlineTime || '08:30');
      setStartDate(initialData.startDate || todayDateString);
      setEndDate(initialData.endDate || '');
      setFrequency(initialData.frequency || 'daily');
      setDaysOfWeek(initialData.daysOfWeek || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setCategory('Sugar');
      setScheduledTime('08:00');
      setRepeatIntervalMinutes(5);
      setDeadlineTime('08:30');
      setStartDate(todayDateString);
      setEndDate('');
      setFrequency('daily');
      setDaysOfWeek(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      setNotes('');
    }
    setError('');
  }, [isOpen, initialData, preselectedCompartment]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter a medicine name.');
      return;
    }

    if (!compartment) {
      setError('Please select an available compartment.');
      return;
    }

    if (endDate && endDate < startDate) {
      setError('The schedule end date must be on or after the start date.');
      return;
    }

    // Validate times
    const [sH, sM] = scheduledTime.split(':').map(Number);
    const [dH, dM] = deadlineTime.split(':').map(Number);
    const startMins = sH * 60 + sM;
    let endMins = dH * 60 + dM;
    if (endMins <= startMins) endMins += 24 * 60;

    if (endMins - startMins < 5) {
      setError('The deadline must be at least 5 minutes after the scheduled start time.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        compartment: Number(compartment),
        scheduledTime,
        repeatIntervalMinutes: Number(repeatIntervalMinutes),
        deadlineTime,
        startDate,
        endDate,
        frequency,
        daysOfWeek,
        notes: notes.trim()
      };

      if (initialData && initialData._id) {
        await api.patch(`/medicines/${initialData._id}`, payload);
      } else {
        await api.post('/medicines', payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save medicine schedule.');
    } finally {
      setLoading(false);
    }
  };

  // Determine which compartments to display in dropdown
  const selectableOptions = initialData
    ? [initialData.compartment, ...availableCompartments].filter((v, i, a) => a.indexOf(v) === i).sort()
    : availableCompartments;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {initialData ? 'Edit Medicine Schedule' : 'Assign Medicine to Box'}
              </h2>
              <p className="text-xs text-slate-500">Configure compartment, reminder timings, and deadline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Medicine Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Medicine Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sugar Tablet (Metformin 500mg)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          {/* Category & Compartment Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
              >
                <option value="Sugar">Sugar / Diabetes</option>
                <option value="BP">BP / Hypertension</option>
                <option value="Cold">Cold / Cough / Fever</option>
                <option value="Heart">Heart / Cardiology</option>
                <option value="Pain">Pain Relief / Arthritis</option>
                <option value="Vitamin">Vitamin / Supplement</option>
                <option value="Other">Other Prescribed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Box Compartment <span className="text-rose-500">*</span>
              </label>
              {selectableOptions.length === 0 ? (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-2 font-medium">
                  All 3 compartments are full.
                </div>
              ) : (
                <select
                  value={compartment}
                  onChange={(e) => setCompartment(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                >
                  <option value="">Select Compartment</option>
                  {selectableOptions.map((c) => (
                    <option key={c} value={c}>
                      Compartment {c} {occupiedCompartments.includes(c) && !initialData ? '(Occupied)' : '(Available)'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Schedule Date & Frequency Row */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-sky-50/50 rounded-xl border border-sky-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                Schedule Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500 font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Date when medicine begins</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                Schedule End Date (Optional)
              </label>
              <input
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500 font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Leave blank to continue indefinitely</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-teal-600" />
                Schedule Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-teal-500 font-medium"
              >
                <option value="daily">Daily (Every Day)</option>
                <option value="specific_days">Selected Days of Week</option>
              </select>
              <span className="text-[10px] text-teal-700 font-semibold mt-1 block">Repeats at scheduled time</span>
            </div>

            {frequency === 'specific_days' && (
              <div className="col-span-2 pt-2 border-t border-sky-100 flex items-center gap-1.5 justify-between">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const isChecked = daysOfWeek.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => {
                        if (isChecked) {
                          setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
                        } else {
                          setDaysOfWeek([...daysOfWeek, day]);
                        }
                      }}
                      className={`px-2 py-1 text-[11px] rounded-md font-bold transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-white text-slate-500 border border-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scheduled Time & Deadline Row */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                Scheduled Dose Time
              </label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">First spoken reminder starts</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5 text-rose-700">
                <Clock className="w-3.5 h-3.5 text-rose-600" />
                Final Deadline
              </label>
              <input
                type="time"
                required
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-rose-500 text-rose-700 font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Marked missed & alerts sent</span>
            </div>
          </div>

          {/* Repeat Interval */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              Repeat Reminder Interval
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="60"
                value={repeatIntervalMinutes}
                onChange={(e) => setRepeatIntervalMinutes(e.target.value)}
                className="w-24 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500 font-medium"
              />
              <span className="text-xs text-slate-500">minutes between voice reminders while dose is pending</span>
            </div>
          </div>

          {/* Caregiver Instructions / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Caregiver Notes (Optional)
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Give 1 tablet with lukewarm water after breakfast"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!initialData && selectableOptions.length === 0)}
              className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? 'Saving...' : initialData ? 'Update Schedule' : 'Save & Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
