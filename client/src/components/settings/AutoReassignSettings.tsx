import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import Toggle from '../common/Toggle';

// Manager control for auto-reassigning assigned jobs that are never accepted
// (e.g. the transporter's phone screen was off and they missed the alert).
// Applies to all assignment methods: auto, dispatcher-assigned, and claimed.
export default function AutoReassignSettings() {
  const [enabled, setEnabled] = useState(true);
  const [timeoutMinutes, setTimeoutMinutes] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [enabledRes, minutesRes] = await Promise.all([
        api.getConfigByKey('auto_reassign_enabled'),
        api.getConfigByKey('auto_reassign_timeout_minutes'),
      ]);
      if (!enabledRes.error && enabledRes.data?.value !== undefined) {
        setEnabled(enabledRes.data.value !== false);
      }
      if (!minutesRes.error && minutesRes.data?.value !== undefined) {
        const parsed = Number(minutesRes.data.value);
        if (!Number.isNaN(parsed) && parsed > 0) {
          setTimeoutMinutes(parsed);
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const enabledRes = await api.updateConfig('auto_reassign_enabled', enabled);
      if (enabledRes.error) throw new Error(enabledRes.error);
      const minutesRes = await api.updateConfig('auto_reassign_timeout_minutes', timeoutMinutes);
      if (minutesRes.error) throw new Error(minutesRes.error);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save settings',
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Auto-Reassign Unaccepted Jobs</h3>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <h4 className="font-medium text-gray-900">Automatic Reassignment</h4>
            <p className="text-sm text-gray-500">
              When a transporter does not accept an assigned job within the timeout, it is
              automatically reassigned to the next available transporter. Applies to
              auto-assigned, dispatcher-assigned, and claimed jobs. The transporter who
              missed the job is notified the next time they are active.
            </p>
          </div>
          <Toggle
            enabled={enabled}
            onChange={setEnabled}
            size="lg"
            ariaLabel="Auto-reassign unaccepted jobs"
          />
        </div>
        {enabled && (
          <div className="flex items-center gap-2 mt-3">
            <label className="text-sm text-gray-700">Reassign after:</label>
            <input
              type="number"
              min={1}
              value={timeoutMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) setTimeoutMinutes(val);
              }}
              className="w-16 text-center text-sm border border-gray-300 rounded px-1 py-1"
            />
            <span className="text-xs text-gray-400">min</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
