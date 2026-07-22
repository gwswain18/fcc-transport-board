import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import Toggle from '../common/Toggle';

// Manager control for the auto-assign algorithm. Floor-based (default): jobs
// go first to the transporter covering the patient's floor that day (the floor
// they chose at shift start, falling back to their profile floor), with
// workload as the tie-breaker. Off: pure workload balancing — fewest jobs
// today first, regardless of floor.
export default function AssignmentAlgorithmSettings() {
  const [floorFirst, setFloorFirst] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const response = await api.getConfigByKey('auto_assign_floor_first');
      if (!response.error && response.data?.value !== undefined) {
        setFloorFirst(response.data.value !== false);
      }
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const response = await api.updateConfig('auto_assign_floor_first', next);
    if (response.error) {
      setError(response.error);
    } else {
      setFloorFirst(next);
      setSuccess(
        next
          ? 'Floor-based assignment enabled.'
          : 'Balanced assignment enabled.'
      );
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
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Auto-Assignment Algorithm</h3>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-700">{success}</div>
      )}

      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <h4 className="font-medium text-gray-900">
              {floorFirst ? 'Floor-based assignment' : 'Balanced assignment'}
            </h4>
            <p className="text-sm text-gray-500">
              {floorFirst
                ? "Jobs are auto-assigned first to the transporter covering the patient's floor that day (the floor they selected at shift start, or their profile floor). If no one is covering that floor, the least-busy available transporter gets the job."
                : 'Jobs are auto-assigned to whichever available transporter has completed the fewest jobs today, regardless of floor. Turn on to prefer the transporter covering the patient’s floor.'}
            </p>
          </div>
          <Toggle
            enabled={floorFirst}
            disabled={saving}
            onChange={handleToggle}
            ariaLabel="Floor-based auto-assignment"
          />
        </div>
      </div>
    </div>
  );
}
