import React, { useState, useEffect } from 'react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  Cpu,
  Wifi,
  WifiOff,
  Key,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Radio,
  Clock,
  Code2
} from 'lucide-react';

export default function DeviceManagementPage() {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const fetchDevice = async () => {
    try {
      setLoading(true);
      const res = await api.get('/devices');
      if (res.data.success) {
        setDevice(res.data.device);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevice();
  }, []);

  const handleConfirmGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/devices/credentials');
      if (res.data.success) {
        setNewCredentials(res.data.credentials);
        fetchDevice();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate credentials');
    } finally {
      setGenerating(false);
      setConfirmModalOpen(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Device Management & ESP32 Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your physical 3-compartment smart medicine box connection, tokens, and hardware wiring.
          </p>
        </div>

        <button
          onClick={() => setConfirmModalOpen(true)}
          disabled={generating}
          className="px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <Key className="w-4 h-4 text-amber-400" />
          <span>Generate ESP32 Token</span>
        </button>
      </div>

      {/* Generated Token Alert Box */}
      {newCredentials && (
        <div className="p-6 rounded-3xl bg-amber-50/90 border border-amber-300 text-amber-950 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <Key className="w-5 h-5 text-amber-600" />
            <span>New ESP32 Device Credentials Generated</span>
          </div>
          <p className="text-xs text-amber-800">
            Copy this Device Token and Device ID into your ESP32 <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">config.h</code> file. For security, this token cannot be viewed again once you leave this page.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-white border border-amber-200">
              <span className="text-[11px] text-slate-400 block font-semibold">Device ID</span>
              <code className="text-xs font-mono font-bold text-slate-900">{newCredentials.deviceId}</code>
            </div>
            <div className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between">
              <div className="truncate mr-2">
                <span className="text-[11px] text-slate-400 block font-semibold">Device Secret Token</span>
                <code className="text-xs font-mono font-bold text-slate-900 truncate block">
                  {newCredentials.deviceToken}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(newCredentials.deviceToken)}
                className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToken ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Status Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                device?.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {device?.isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">{device?.deviceName}</h2>
                <StatusBadge
                  status={device?.isOnline ? 'green' : 'grey'}
                  label={device?.isOnline ? 'Online (Heartbeat Active)' : 'Offline'}
                />
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Device ID: {device?.deviceId}</p>
            </div>
          </div>

          <button
            onClick={fetchDevice}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Refresh device status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Device Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-1">Firmware Version</span>
            <span className="font-extrabold text-slate-900 text-sm">v{device?.firmwareVersion || '1.0.0'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-1">Last Heartbeat</span>
            <span className="font-bold text-slate-800 text-xs">
              {device?.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleTimeString() : 'Never'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-1">Wi-Fi Signal (RSSI)</span>
            <span className="font-bold text-slate-800 text-xs">
              {device?.wifiRssi ? `${device.wifiRssi} dBm` : '—'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-1">Local IP Address</span>
            <span className="font-mono font-bold text-slate-800 text-xs">
              {device?.ipAddress || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Hardware Pinout & Wiring Specifications */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Code2 className="w-5 h-5 text-sky-600" />
          <span>ESP32 Physical Wiring Reference</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          The physical box uses three lid sensors, the DS3231 RTC, an OLED on a separate I²C bus, and the MAX98357A speaker amplifier. Local reminders continue from the RTC if Wi-Fi temporarily disconnects. C1 uses the KY-025 digital output (LOW=open); C2 and C3 use bare reed switches (HIGH=open).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
          {/* Sensors & Display */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="font-bold text-slate-900 block mb-2 text-xs">Sensors & Display Pins</span>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Reed Switch 1 (Comp 1)</span>
              <span className="font-mono font-bold text-sky-700">GPIO 25 (KY-025 D0)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Reed Switch 2 (Comp 2)</span>
              <span className="font-mono font-bold text-sky-700">GPIO 26 (Pull-up)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Reed Switch 3 (Comp 3)</span>
              <span className="font-mono font-bold text-sky-700">GPIO 27 (Pull-up)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">DS3231 RTC (I2C bus 0)</span>
              <span className="font-mono font-bold text-teal-700">SDA: GPIO 21 • SCL: GPIO 22</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">SSD1306 OLED (I2C bus 1)</span>
              <span className="font-mono font-bold text-teal-700">SDA: GPIO 18 • SCL: GPIO 19</span>
            </div>
          </div>

          {/* Audio & Power */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="font-bold text-slate-900 block mb-2 text-xs">Audio & Power</span>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">MAX98357A I2S DAC / Amp</span>
              <span className="font-mono font-bold text-amber-700">BCLK: 32 • LRC: 33 • DIN: 23</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">MAX98357A SD/EN</span>
              <span className="font-mono font-bold text-amber-700">Keep HIGH / 3.3V</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Speaker connection</span>
              <span className="font-mono font-bold text-slate-700">Across SPK+ and SPK− only</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">System Power</span>
              <span className="font-mono font-bold text-slate-700">Use board-rated supply</span>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModalOpen}
        title="Generate New ESP32 Credentials?"
        message="This will regenerate the device secret token. Any currently flashed device using the old token will need to be updated with the new token in config.h."
        confirmText="Generate Token"
        cancelText="Cancel"
        isDanger={false}
        loading={generating}
        onConfirm={handleConfirmGenerate}
        onCancel={() => setConfirmModalOpen(false)}
      />
    </div>
  );
}
