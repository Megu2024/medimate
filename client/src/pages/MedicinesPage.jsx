import React, { useState, useEffect } from 'react';
import api from '../services/api';
import MedicineModal from '../components/MedicineModal';
import ConfirmationModal from '../components/ConfirmationModal';
import StatusBadge from '../components/StatusBadge';
import {
  Pill,
  Plus,
  Clock,
  BellRing,
  Edit2,
  Trash2,
  AlertCircle,
  Check,
  Box,
  RefreshCw
} from 'lucide-react';

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState([]);
  const [compartmentsInfo, setCompartmentsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [medicineToDeactivate, setMedicineToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [medsRes, compsRes] = await Promise.all([
        api.get('/medicines'),
        api.get('/medicines/available-compartments')
      ]);

      if (medsRes.data.success) {
        setMedicines(medsRes.data.medicines);
      }
      if (compsRes.data.success) {
        setCompartmentsInfo(compsRes.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load medicines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (med) => {
    setEditingMedicine(med);
    setModalOpen(true);
  };

  const handleDeactivateClick = (med) => {
    setMedicineToDeactivate(med);
    setConfirmModalOpen(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!medicineToDeactivate) return;
    setDeactivating(true);
    try {
      await api.delete(`/medicines/${medicineToDeactivate._id}`);
      setConfirmModalOpen(false);
      setMedicineToDeactivate(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate medicine');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading && medicines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading medicine schedules...</p>
      </div>
    );
  }

  const activeMedicines = medicines.filter((m) => m.isActive);
  const inactiveMedicines = medicines.filter((m) => !m.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Medicine Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Assign up to 3 active medicines to physical box compartments with scheduled dose windows.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingMedicine(null);
            setModalOpen(true);
          }}
          disabled={compartmentsInfo?.isFull}
          className="px-4 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Medicine</span>
        </button>
      </div>

      {/* Compartment Allocation Status Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-800">
            Physical Box Compartments (3 Max)
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {activeMedicines.length} of 3 Allocated
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((compNum) => {
            const med = activeMedicines.find((m) => m.compartment === compNum);
            return (
              <div
                key={compNum}
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  med
                    ? 'bg-sky-50/60 border-sky-200'
                    : 'bg-slate-50 border-slate-200 border-dashed'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">Comp {compNum}</span>
                  <StatusBadge
                    status={med ? 'green' : 'grey'}
                    label={med ? 'Assigned' : 'Available'}
                    size="sm"
                  />
                </div>
                <div className="mt-2 truncate">
                  <p className="text-xs font-extrabold text-slate-800 truncate">
                    {med ? med.name : 'Empty'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {med ? `${med.scheduledTime} - ${med.deadlineTime}` : 'Open for assignment'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Medicines List */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3">Active Box Medicines</h2>
        {activeMedicines.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
            <Box className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No active medicines configured</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add your patient's prescribed medicines and assign them to Compartment 1, 2, or 3.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMedicines.map((med) => (
              <div
                key={med._id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">
                      Compartment {med.compartment}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {med.category}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 tracking-tight">{med.name}</h3>
                  {med.notes && (
                    <p className="text-xs text-slate-500 mt-1 italic">"{med.notes}"</p>
                  )}

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-sky-600" />
                        Scheduled Dose:
                      </span>
                      <span className="font-bold text-slate-800">{med.scheduledTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1 text-rose-600">
                        <Clock className="w-3.5 h-3.5 text-rose-500" />
                        Deadline:
                      </span>
                      <span className="font-bold text-rose-700">{med.deadlineTime}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <BellRing className="w-3 h-3 text-amber-500" />
                        Spoken Repeat:
                      </span>
                      <span>Every {med.repeatIntervalMinutes}m</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(med)}
                    className="p-2 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeactivateClick(med)}
                    className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Deactivate</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive / Past Medicines Section */}
      {inactiveMedicines.length > 0 && (
        <div className="pt-4 border-t border-slate-200">
          <h2 className="text-sm font-bold text-slate-600 mb-3">Deactivated / Past Medicines</h2>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {inactiveMedicines.map((med) => (
              <div key={med._id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-700">{med.name}</span>
                  <span className="text-slate-400 ml-2">({med.category} • Was in Comp {med.compartment})</span>
                </div>
                <StatusBadge status="grey" label="Deactivated" size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <MedicineModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingMedicine(null);
        }}
        onSaved={fetchData}
        initialData={editingMedicine}
      />

      {/* Deactivate Confirmation */}
      <ConfirmationModal
        isOpen={confirmModalOpen}
        title="Deactivate Medicine"
        message={`Are you sure you want to deactivate "${medicineToDeactivate?.name}"? Compartment ${medicineToDeactivate?.compartment} will become free for new medicines. Past dose records will be preserved.`}
        confirmText="Deactivate"
        isDanger={true}
        loading={deactivating}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => {
          setConfirmModalOpen(false);
          setMedicineToDeactivate(null);
        }}
      />
    </div>
  );
}
