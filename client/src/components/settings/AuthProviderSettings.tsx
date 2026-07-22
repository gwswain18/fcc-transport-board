import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import Toggle from '../common/Toggle';

// Manager control for third-party sign-in (Google / Microsoft). Turning a
// provider off hides its buttons on the Login and Profile pages and blocks the
// server endpoints (sign-in AND account linking). Password sign-in is never
// affected. Built so OAuth can be kept out of sight during the pilot without
// removing it.
export default function AuthProviderSettings() {
  const [google, setGoogle] = useState(true);
  const [microsoft, setMicrosoft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const microsoftConfigured = !!import.meta.env.VITE_MICROSOFT_CLIENT_ID;

  useEffect(() => {
    (async () => {
      const response = await api.getAuthProviders();
      if (response.data) {
        setGoogle(response.data.google);
        setMicrosoft(response.data.microsoft);
      }
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (
    key: 'google_auth_enabled' | 'microsoft_auth_enabled',
    next: boolean
  ) => {
    setSaving(key);
    setError(null);
    setSuccess(null);
    const response = await api.updateConfig(key, next);
    if (response.error) {
      setError(response.error);
    } else {
      const label = key === 'google_auth_enabled' ? 'Google' : 'Microsoft';
      if (key === 'google_auth_enabled') setGoogle(next);
      else setMicrosoft(next);
      setSuccess(`${label} sign-in ${next ? 'enabled' : 'disabled'}.`);
    }
    setSaving(null);
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
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Third-Party Sign-In</h3>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-700">{success}</div>
      )}

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <h4 className="font-medium text-gray-900">Google sign-in</h4>
              <p className="text-sm text-gray-500">
                Shows the Google button on the login page and allows users to link
                Google to their account.
              </p>
            </div>
            <Toggle
              enabled={google}
              disabled={saving !== null}
              onChange={(next) => handleToggle('google_auth_enabled', next)}
              ariaLabel="Google sign-in"
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <h4 className="font-medium text-gray-900">Microsoft sign-in</h4>
              <p className="text-sm text-gray-500">
                Shows the Microsoft button on the login page and allows users to
                link Microsoft to their account.
              </p>
              {!microsoftConfigured && (
                <p className="text-sm text-amber-600 mt-1">
                  Microsoft is not configured in this deployment — the button stays
                  hidden until the Microsoft client ID is set, even when this toggle
                  is on.
                </p>
              )}
            </div>
            <Toggle
              enabled={microsoft}
              disabled={saving !== null}
              onChange={(next) => handleToggle('microsoft_auth_enabled', next)}
              ariaLabel="Microsoft sign-in"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-50 text-sm text-amber-800">
          Accounts created through Google or Microsoft that never set a password
          cannot sign in while their provider is off — they can regain access via
          "Forgot your password". Turning both providers off also pauses new-user
          self-registration, since sign-up happens through these providers.
        </div>
      </div>
    </div>
  );
}
