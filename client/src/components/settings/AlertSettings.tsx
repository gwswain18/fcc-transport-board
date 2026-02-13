import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { AlertSettings as AlertSettingsType, AlertTiming } from '../../types';

const DEFAULT_TIMING: AlertTiming = {
  pending_timeout_minutes: 5,
  stat_timeout_minutes: 2,
  acceptance_timeout_minutes: 5,
  break_alert_minutes: 30,
  offline_alert_minutes: 2,
};

const DEFAULT_SETTINGS: AlertSettingsType = {
  master_enabled: true,
  alerts: {
    pending_timeout: true,
    stat_timeout: true,
    acceptance_timeout: true,
    break_alert: true,
    offline_alert: true,
    cycle_time_alert: true,
  },
  timing: DEFAULT_TIMING,
  require_explanation_on_dismiss: true,
  auto_logout_enabled: false,
  auto_logout_time: '19:00',
};

export default function AlertSettings() {
  const [settings, setSettings] = useState<AlertSettingsType>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [forceLogoutConfirm, setForceLogoutConfirm] = useState(false);
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await api.getConfigByKey('alert_settings');
      if (response.error && response.error !== 'Config key not found') {
        console.error('[AlertSettings] Failed to load settings:', response.error);
        setMessage({ type: 'error', text: 'Failed to load alert settings. Using defaults.' });
      } else if (!response.error) {
        const value = response.data?.value as AlertSettingsType | undefined;
        if (value) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...value,
            alerts: {
              ...DEFAULT_SETTINGS.alerts,
              ...(value.alerts || {}),
            },
            timing: {
              ...DEFAULT_TIMING,
              ...(value.timing || {}),
            },
          });
        }
      }
    } catch (error) {
      console.error('[AlertSettings] Exception loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load alert settings. Using defaults.' });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await api.updateConfig('alert_settings', settings);
      if (response.error) {
        console.error('[AlertSettings] Failed to save settings:', response.error);
        setMessage({ type: 'error', text: 'Failed to save settings' });
      } else {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      }
    } catch (error) {
      console.error('[AlertSettings] Exception saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    }
    setSaving(false);
  };

  const handleMasterToggle = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, master_enabled: enabled }));
  };

  const handleAlertToggle = (alertKey: keyof AlertSettingsType['alerts'], enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      alerts: { ...prev.alerts, [alertKey]: enabled },
    }));
  };

  const handleTimingChange = (key: keyof AlertTiming, value: number) => {
    setSettings((prev) => ({
      ...prev,
      timing: { ...(prev.timing || DEFAULT_TIMING), [key]: value },
    }));
  };

  const handleExplanationToggle = (required: boolean) => {
    setSettings((prev) => ({ ...prev, require_explanation_on_dismiss: required }));
  };

  const handleForceLogoutAll = async () => {
    if (!forceLogoutConfirm) {
      setForceLogoutConfirm(true);
      return;
    }
    setForceLogoutLoading(true);
    setForceLogoutConfirm(false);
    try {
      const response = await api.forceLogoutAll();
      if (response.error) {
        setMessage({ type: 'error', text: response.error });
      } else {
        setMessage({ type: 'success', text: response.data?.message || 'All users logged out successfully' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to force logout all users' });
    }
    setForceLogoutLoading(false);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Alert Settings</h3>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Master Toggle */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Master Alert Switch</h4>
            <p className="text-sm text-gray-500">Enable or disable all alerts system-wide</p>
          </div>
          <Toggle
            enabled={settings.master_enabled}
            onChange={handleMasterToggle}
            size="lg"
          />
        </div>
      </div>

      {/* Individual Alert Toggles */}
      <div className={`space-y-4 mb-6 ${!settings.master_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className="font-medium text-gray-900">Individual Alerts</h4>

        <ToggleRow
          label="Pending Timeout Alerts"
          description="Alert when routine requests wait too long without assignment"
          enabled={settings.alerts.pending_timeout}
          onChange={(v) => handleAlertToggle('pending_timeout', v)}
          timingMinutes={settings.timing?.pending_timeout_minutes ?? DEFAULT_TIMING.pending_timeout_minutes}
          onTimingChange={(v) => handleTimingChange('pending_timeout_minutes', v)}
        />

        <ToggleRow
          label="STAT Timeout Alerts"
          description="Alert when STAT priority requests wait too long"
          enabled={settings.alerts.stat_timeout}
          onChange={(v) => handleAlertToggle('stat_timeout', v)}
          timingMinutes={settings.timing?.stat_timeout_minutes ?? DEFAULT_TIMING.stat_timeout_minutes}
          onTimingChange={(v) => handleTimingChange('stat_timeout_minutes', v)}
        />

        <ToggleRow
          label="Acceptance Timeout Alerts"
          description="Alert when assigned requests aren't accepted in time"
          enabled={settings.alerts.acceptance_timeout}
          onChange={(v) => handleAlertToggle('acceptance_timeout', v)}
          timingMinutes={settings.timing?.acceptance_timeout_minutes ?? DEFAULT_TIMING.acceptance_timeout_minutes}
          onTimingChange={(v) => handleTimingChange('acceptance_timeout_minutes', v)}
        />

        <ToggleRow
          label="Break Duration Alerts"
          description="Alert when transporters exceed break time limit"
          enabled={settings.alerts.break_alert}
          onChange={(v) => handleAlertToggle('break_alert', v)}
          timingMinutes={settings.timing?.break_alert_minutes ?? DEFAULT_TIMING.break_alert_minutes}
          onTimingChange={(v) => handleTimingChange('break_alert_minutes', v)}
        />

        <ToggleRow
          label="Offline Alerts"
          description="Alert when transporters go offline unexpectedly"
          enabled={settings.alerts.offline_alert}
          onChange={(v) => handleAlertToggle('offline_alert', v)}
          timingMinutes={settings.timing?.offline_alert_minutes ?? DEFAULT_TIMING.offline_alert_minutes}
          onTimingChange={(v) => handleTimingChange('offline_alert_minutes', v)}
        />

        <ToggleRow
          label="Cycle Time Alerts"
          description="Alert when transport phases exceed thresholds"
          enabled={settings.alerts.cycle_time_alert}
          onChange={(v) => handleAlertToggle('cycle_time_alert', v)}
        />

      </div>

      {/* Explanation Requirement */}
      <div className="mb-6 p-4 bg-primary-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Require Dismissal Explanation</h4>
            <p className="text-sm text-gray-500">
              When enabled, dispatchers must provide a reason when dismissing alerts
            </p>
          </div>
          <Toggle
            enabled={settings.require_explanation_on_dismiss}
            onChange={handleExplanationToggle}
          />
        </div>
      </div>

      {/* Auto-Logout */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-medium text-gray-900">Auto-Logout All Users</h4>
            <p className="text-sm text-gray-500">
              Automatically end all dispatcher sessions and transporter shifts at a specified time each day
            </p>
          </div>
          <Toggle
            enabled={settings.auto_logout_enabled ?? false}
            onChange={(v) => setSettings((prev) => ({ ...prev, auto_logout_enabled: v }))}
          />
        </div>
        {settings.auto_logout_enabled && (
          <div className="flex items-center gap-2 mt-2">
            <label className="text-sm text-gray-700">Logout time:</label>
            <input
              type="time"
              value={settings.auto_logout_time ?? '19:00'}
              onChange={(e) => setSettings((prev) => ({ ...prev, auto_logout_time: e.target.value }))}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            />
          </div>
        )}

        {/* Force Logout All Button */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Log Off All Users Now</p>
              <p className="text-xs text-gray-500">
                Immediately end all dispatcher sessions, transporter shifts, and set everyone offline
              </p>
            </div>
            <div className="flex items-center gap-2">
              {forceLogoutConfirm && (
                <button
                  onClick={() => setForceLogoutConfirm(false)}
                  className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleForceLogoutAll}
                disabled={forceLogoutLoading}
                className={`text-sm px-3 py-1.5 rounded font-medium ${
                  forceLogoutConfirm
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {forceLogoutLoading
                  ? 'Logging out...'
                  : forceLogoutConfirm
                    ? 'Confirm Log Off All'
                    : 'Log Off All Users'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
  size = 'md',
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  size?: 'md' | 'lg';
}) {
  const sizeClasses = size === 'lg' ? 'w-14 h-8' : 'w-11 h-6';
  const dotSizeClasses = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  const translateClass = size === 'lg' ? 'translate-x-6' : 'translate-x-5';

  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`${sizeClasses} relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        enabled ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <span
        className={`${dotSizeClasses} pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? translateClass : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onChange,
  timingMinutes,
  onTimingChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  timingMinutes?: number;
  onTimingChange?: (minutes: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {timingMinutes !== undefined && onTimingChange && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={timingMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) onTimingChange(val);
              }}
              className="w-16 text-center text-sm border border-gray-300 rounded px-1 py-1"
            />
            <span className="text-xs text-gray-400">min</span>
          </div>
        )}
        <Toggle enabled={enabled} onChange={onChange} />
      </div>
    </div>
  );
}
