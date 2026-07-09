import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Free-text notes</h3>
      <p className="text-sm text-gray-600 mb-4">
        Notes on transport requests and delays are the only free-text fields in
        the app. Disable them to guarantee that no patient identifiers can be
        entered — only room number, transport time, and destination are recorded.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(e) => handleToggle(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-gray-700">
            {enabled ? 'Notes are enabled' : 'Notes are disabled'}
          </span>
        </label>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-green-600">{success}</p>}
    </div>
  );
}
