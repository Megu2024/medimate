import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Pill,
  History,
  FileText,
  Bell,
  Cpu,
  Settings,
  UserCheck,
  LogOut,
  Sparkles
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const { logout, patient } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/medicines', label: 'Medicines & Box', icon: Pill },
    { to: '/history', label: 'Dose History', icon: History },
    {
      to: '/reports',
      label: 'Report Analysis',
      icon: FileText,
      badge: 'AI Gemini'
    },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/devices', label: 'Device & ESP32', icon: Cpu },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/profile', label: 'Update Profile', icon: UserCheck }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } pt-16 lg:pt-4`}
      >
        {/* Navigation Links */}
        <div className="px-4 py-2 space-y-1">
          <div className="px-3 pb-3 pt-1">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Caregiver Navigation
            </span>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose && onClose()}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 shadow-2xs border border-sky-100 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-linear-to-r from-teal-500 to-sky-500 text-white shadow-2xs">
                    <Sparkles className="w-2.5 h-2.5" />
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Profile Summary & Logout */}
        <div className="p-4 border-t border-slate-100">
          {patient && (
            <div className="p-3 mb-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <span className="text-[11px] text-slate-400 block font-medium">Care Recipient</span>
              <p className="font-bold text-slate-800 text-sm">{patient.name}</p>
              <div className="flex items-center justify-between text-slate-500 text-[11px] mt-1">
                <span>Age: {patient.age} years</span>
                <span className="text-sky-600 font-medium">{patient.relationship}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-100"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
