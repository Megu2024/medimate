import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Heart,
  Bell,
  Wifi,
  WifiOff,
  User,
  LogOut,
  Settings as SettingsIcon,
  Menu,
  X
} from 'lucide-react';

export default function Navbar({ onMobileMenuToggle, isMobileMenuOpen }) {
  const { user, patient, logout } = useAuth();
  const { isConnected } = useSocket();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3">
      <div className="flex items-center justify-between">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Toggle Navigation"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-sky-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
              <Heart className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <span className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                MediMate
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-sky-100 text-sky-700 tracking-wider">
                  IoT
                </span>
              </span>
              <span className="text-[11px] text-slate-400 block -mt-1 hidden sm:block">
                Smart Medicine Box
              </span>
            </div>
          </Link>
        </div>

        {/* Center / Right Status & Profile Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Real-time Cloud/ESP32 Connection Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs">
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-medium text-slate-700">Cloud Sync Active</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="font-medium text-slate-500">Connecting...</span>
              </>
            )}
          </div>

          {/* Patient Quick Glance Pill */}
          {patient && (
            <div className="hidden md:flex items-center gap-2 pl-3 pr-4 py-1 rounded-full bg-sky-50/70 border border-sky-100 text-xs">
              {patient.photoUrl ? (
                <img
                  src={patient.photoUrl}
                  alt={patient.name}
                  className="w-6 h-6 rounded-full object-cover border border-sky-200"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-sky-200 text-sky-800 flex items-center justify-center font-bold text-[10px]">
                  {patient.name.charAt(0)}
                </div>
              )}
              <span className="font-medium text-sky-950">
                {patient.name} <span className="text-sky-700 font-normal">({patient.age} yrs)</span>
              </span>
            </div>
          )}

          {/* Notifications Icon Button */}
          <Link
            to="/notifications"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative"
            title="Notification Alerts"
          >
            <Bell className="w-5 h-5" />
          </Link>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
                {user?.fullName?.charAt(0) || 'C'}
              </div>
              <span className="text-xs font-semibold text-slate-700 hidden lg:inline">
                {user?.fullName?.split(' ')[0]}
              </span>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                onClick={() => setDropdownOpen(false)}
              >
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">{user?.fullName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                </div>

                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-sky-600 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  Update Profile & Patient
                </Link>

                <Link
                  to="/settings"
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-sky-600 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4 text-slate-400" />
                  Settings & Gemini Key
                </Link>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
