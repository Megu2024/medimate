import React, { useState, useEffect } from 'react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  Bell,
  MessageSquare,
  Smartphone,
  RefreshCw,
  Send,
  CheckCircle,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';

export default function NotificationsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testError, setTestError] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/notifications');
      if (res.data.success) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSendTest = async (channel) => {
    setSendingTest(true);
    setTestResult('');
    setTestError('');
    try {
      const res = await api.post('/settings/test-notification', { channel });
      if (res.data.success) {
        setTestResult(res.data.message);
        fetchLogs();
      }
    } catch (err) {
      setTestError(err.response?.data?.message || `Failed to dispatch test ${channel}`);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Notification Logs & Alerts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time audit log of SMS alerts, missed-dose notifications, and push messages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSendTest('sms')}
            disabled={sendingTest}
            className="px-3.5 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Test SMS</span>
          </button>
          <button
            onClick={() => handleSendTest('push')}
            disabled={sendingTest}
            className="px-3.5 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Test Push</span>
          </button>
          <button
            onClick={fetchLogs}
            className="p-2 text-slate-600 hover:text-sky-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {testResult && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {testError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{testError}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No notification logs recorded yet. When doses are taken or missed, alerts appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Alert Type</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Message Preview</th>
                  <th className="py-3 px-4">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        {log.channel === 'sms' ? (
                          <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                        )}
                        {log.channel.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                      {log.notificationType.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {log.recipient}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.message}>
                      {log.message}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge
                        status={
                          log.status === 'sent'
                            ? 'green'
                            : log.status === 'failed'
                            ? 'red'
                            : log.status === 'provider_unconfigured'
                            ? 'amber'
                            : 'grey'
                        }
                        label={
                          log.status === 'sent'
                            ? 'Sent'
                            : log.status === 'provider_unconfigured'
                            ? 'Provider Unconfigured'
                            : log.status === 'failed'
                            ? 'Delivery Failed'
                            : 'Simulated'
                        }
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
