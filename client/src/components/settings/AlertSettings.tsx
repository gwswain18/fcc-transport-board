import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { AlertSettings as AlertSettingsType } from '../../types';

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
  require_explanation_on_dismiss: true,
};

export default function AlertSettings() {
  const [settings, setSettings] = useState<AlertSettingsType>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const response = await api.getConfigByKey('alert_settings');
    const value = response.data?.value as AlertSettingsType | undefined;
    if (value) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...value,
        alerts: {
          ...DEFAULT_SETTINGS.alerts,
          ...(value.alerts || {}),
        },
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const response = await api.updateConfig('alert_settings', settings);
    if (response.error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully' });
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

  const handleExplanationToggle = (required: boolean) => {
    setSettings((prev) => ({ ...prev, require_explanation_on_dismiss: required }));
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
        />

        <ToggleRow
          label="STAT Timeout Alerts"
          description="Alert when STAT priority requests wait too long"
          enabled={settings.alerts.stat_timeout}
          onChange={(v) => handleAlertToggle('stat_timeout', v)}
        />

        <ToggleRow
          label="Acceptance Timeout Alerts"
          description="Alert when assigned requests aren't accepted in time"
          enabled={settings.alerts.acceptance_timeout}
          onChange={(v) => handleAlertToggle('acceptance_timeout', v)}
        />

        <ToggleRow
          label="Break Duration Alerts"
          description="Alert when transporters exceed break time limit"
          enabled={settings.alerts.break_alert}
          onChange={(v) => handleAlertToggle('break_alert', v)}
        />

        <ToggleRow
          label="Offline Alerts"
          description="Alert when transporters go offline unexpectedly"
          enabled={settings.alerts.offline_alert}
          onChange={(v) => handleAlertToggle('offline_alert', v)}
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
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}
