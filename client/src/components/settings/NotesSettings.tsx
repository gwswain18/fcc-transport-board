import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import Toggle from '../common/Toggle';

// Manager control for the free-text notes fields (request notes + delay notes).
// Disabling removes the only PHI-entry vector besides room number, transport
// time, and destination. The change takes effect for all users immediately
// (the server broadcasts notes_enabled_changed over the socket).
export default function NotesSettings() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const response = await api.getNotesEnabled();
      if (typeof response.data?.notesEnabled === 'boolean') {
        setEnabled(response.data.notesEnabled);
      }
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const response = await api.updateConfig('notes_enabled', next);
    if (response.error) {
      setError(response.error);
    } else {
      setEnabled(next);
      setSuccess(next ? 'Notes enabled.' : 'Notes disabled.');
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
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Free-text Notes</h3>

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
              {enabled ? 'Notes are enabled' : 'Notes are disabled'}
            </h4>
            <p className="text-sm text-gray-500">
              Notes on transport requests and delays are the only free-text fields in
              the app. Disable them to guarantee that no patient identifiers can be
              entered — only room number, transport time, and destination are recorded.
            </p>
          </div>
          <Toggle
            enabled={enabled}
            disabled={saving}
            onChange={handleToggle}
            ariaLabel="Free-text notes"
          />
        </div>
      </div>
    </div>
  );
}
