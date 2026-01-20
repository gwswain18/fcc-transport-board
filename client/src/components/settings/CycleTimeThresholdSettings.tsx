import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

interface PhaseThreshold {
  minutes: number;
  enabled: boolean;
}

interface ThresholdConfig {
  phase_threshold_response: PhaseThreshold;
  phase_threshold_acceptance: PhaseThreshold;
  phase_threshold_pickup: PhaseThreshold;
  phase_threshold_en_route: PhaseThreshold;
  phase_threshold_transport: PhaseThreshold;
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  phase_threshold_response: { minutes: 2, enabled: true },
  phase_threshold_acceptance: { minutes: 2, enabled: true },
  phase_threshold_pickup: { minutes: 5, enabled: true },
  phase_threshold_en_route: { minutes: 3, enabled: true },
  phase_threshold_transport: { minutes: 5, enabled: true },
};

const PHASE_LABELS: Record<string, string> = {
  phase_threshold_response: 'Response (pending to assigned)',
  phase_threshold_acceptance: 'Acceptance (assigned to accepted)',
  phase_threshold_pickup: 'Pickup (accepted to en_route)',
  phase_threshold_en_route: 'En Route (en_route to with_patient)',
  phase_threshold_transport: 'Transport (with_patient to complete)',
};

export default function CycleTimeThresholdSettings() {
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    setLoading(true);
    const response = await api.getConfig();
    if (response.data?.config) {
      const config = response.data.config as Record<string, string>;
      const loaded: Partial<ThresholdConfig> = {};

      for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof ThresholdConfig)[]) {
        if (config[key]) {
          try {
            loaded[key] = JSON.parse(config[key]);
          } catch {
            loaded[key] = DEFAULT_THRESHOLDS[key];
          }
        }
      }

      setThresholds({ ...DEFAULT_THRESHOLDS, ...loaded });
    }
    setLoading(false);
  };

  const handleThresholdChange = (key: keyof ThresholdConfig, field: 'minutes' | 'enabled', value: number | boolean) => {
    setThresholds((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Save each threshold to config
      for (const [key, value] of Object.entries(thresholds)) {
        const response = await api.updateConfig(key, JSON.stringify(value));
        if (response.error) {
          throw new Error(response.error);
        }
      }
      setSuccess('Thresholds saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save thresholds');
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <p className="text-gray-500">Loading thresholds...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Cycle Time Alert Thresholds
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Configure when alerts should be triggered for each phase of the transport process.
        Alerts will appear when a phase exceeds the specified threshold.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {(Object.keys(thresholds) as (keyof ThresholdConfig)[]).map((key) => (
          <div
            key={key}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={thresholds[key].enabled}
                  onChange={(e) => handleThresholdChange(key, 'enabled', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {PHASE_LABELS[key]}
                </span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={thresholds[key].minutes}
                onChange={(e) => handleThresholdChange(key, 'minutes', parseInt(e.target.value) || 0)}
                disabled={!thresholds[key].enabled}
                className="w-20 px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400"
                min={1}
                max={60}
              />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : 'Save Thresholds'}
        </button>
      </div>
    </div>
  );
}
