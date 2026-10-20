import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Settings as SettingsIcon,
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Smartphone,
  Trash2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Gemini Key State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keySuccess, setKeySuccess] = useState('');
  const [keyError, setKeyError] = useState('');

  // Notification Preferences State
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsRecipientNumber, setSmsRecipientNumber] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState('');
  const [prefsError, setPrefsError] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res.data.success) {
        const s = res.data.settings;
        setSettings(s);
        setSmsEnabled(s.smsEnabled);
        setSmsRecipientNumber(s.smsRecipientNumber || '');
        setPushEnabled(s.pushEnabled);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveGeminiKey = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      setKeyError('Please paste your Google Gemini API key.');
      return;
    }

    setSavingKey(true);
    setKeyError('');
    setKeySuccess('');

    try {
      const res = await api.post('/settings/gemini-key', { apiKey: apiKeyInput.trim() });
      if (res.data.success) {
        setKeySuccess('Gemini key verified and securely stored in encrypted database!');
        setApiKeyInput('');
        fetchSettings();
      }
    } catch (err) {
      setKeyError(err.response?.data?.message || 'Failed to verify and save Gemini API key.');
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteGeminiKey = async () => {
    if (!window.confirm('Remove your custom Gemini API key?')) return;
    try {
      await api.delete('/settings/gemini-key');
      setKeySuccess('Custom Gemini key removed.');
      fetchSettings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove key');
    }
  };

  const handleSaveNotificationPrefs = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefsError('');
    setPrefsSuccess('');

    try {
      const res = await api.patch('/settings', {
        smsEnabled,
        smsRecipientNumber,
        pushEnabled
      });
      if (res.data.success) {
        setPrefsSuccess('Notification preferences saved successfully.');
      }
    } catch (err) {
      setPrefsError(err.response?.data?.message || 'Failed to save notification preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Subscribe to browser push
  const handleEnableBrowserPush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Browser push notifications are not supported by this browser.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Push notification permission was denied.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = settings?.vapidPublicKey;

      if (!vapidKey) {
        alert('Server VAPID public key is not configured.');
        return;
      }

      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      });

      await api.post('/settings/push-subscribe', subscription);
      setPushEnabled(true);
      alert('Browser push notifications enabled successfully!');
      fetchSettings();
    } catch (err) {
      console.error(err);
      alert(`Failed to subscribe for push: ${err.message}`);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Application Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure Google Gemini AI credentials, SMS gateway alerts, and browser push permissions.
        </p>
      </div>

      {/* SECTION 1: Google Gemini API Key Configuration */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-teal-500 to-sky-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Google Gemini AI Configuration</h2>
              <p className="text-xs text-slate-500">Powers multilingual medical report analysis</p>
            </div>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            <span>Get Gemini Key</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Current Key Status Pill */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <div>
              <span className="font-bold text-slate-800 block">
                {settings?.hasCustomGeminiKey
                  ? 'Private Encrypted Gemini Key Configured'
                  : settings?.hasSystemGeminiKey
                  ? 'Using Server Environment Gemini Key'
                  : 'No Gemini Key Configured'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {settings?.geminiKeyMasked || (settings?.hasSystemGeminiKey ? '•••••••• (System Fallback)' : 'Report analysis disabled')}
              </span>
            </div>
          </div>

          {settings?.hasCustomGeminiKey && (
            <button
              onClick={handleDeleteGeminiKey}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer p-1.5 rounded-lg hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Key</span>
            </button>
          )}
        </div>

        {keySuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{keySuccess}</span>
          </div>
        )}

        {keyError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{keyError}</span>
          </div>
        )}

        {/* Key Form */}
        <form onSubmit={handleSaveGeminiKey} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Add / Replace Gemini API Key (Encrypted with AES-256-GCM)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
              />
              <button
                type="submit"
                disabled={savingKey}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-xs whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {savingKey ? 'Verifying...' : 'Save & Encrypt'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Your key is encrypted on the server using AES-256-GCM. It is never exposed in the browser, client storage, or API responses.
          </p>
        </form>
      </div>

      {/* SECTION 2: Notification & Alert Preferences */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">SMS & Push Notification Settings</h2>
            <p className="text-xs text-slate-500">Configure where missed-dose and access alerts are sent</p>
          </div>
        </div>

        {prefsSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{prefsSuccess}</span>
          </div>
        )}

        {prefsError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{prefsError}</span>
          </div>
        )}

        <form onSubmit={handleSaveNotificationPrefs} className="space-y-4">
          {/* SMS Toggle & Phone Number */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">SMS Alerts via Gateway</span>
                <span className="text-[11px] text-slate-400">
                  Sends SMS for successful compartment access and urgent missed dose alerts.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600" />
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Caregiver Mobile Phone Number (E.164 format, e.g. +919876543210)
              </label>
              <input
                type="tel"
                placeholder="+91..."
                value={smsRecipientNumber}
                onChange={(e) => setSmsRecipientNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-sky-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>SMS Provider Status:</span>
              <span className={`font-semibold ${settings?.isSmsProviderConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>
                {settings?.isSmsProviderConfigured ? 'Twilio Live Gateway Configured' : 'Development Mock Mode (Audit Logged)'}
              </span>
            </div>
          </div>

          {/* Browser Push Notification */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Browser Push Notifications</span>
              <span className="text-[11px] text-slate-400">
                Receive browser push alerts when deadlines are missed.
              </span>
            </div>
            <button
              type="button"
              onClick={handleEnableBrowserPush}
              className="px-3.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors cursor-pointer"
            >
              {settings?.hasPushSubscription ? 'Push Active (Update)' : 'Enable Browser Push'}
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingPrefs}
              className="px-6 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {savingPrefs ? 'Saving...' : 'Save Notification Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
