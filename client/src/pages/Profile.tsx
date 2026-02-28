import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { User } from '../types';
import Header from '../components/common/Header';
import PasswordChangeModal from '../components/common/PasswordChangeModal';
import { GoogleLogin } from '@react-oauth/google';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { instance: msalInstance } = useMsal();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const response = await api.getProfile();
    if (response.data?.user) {
      setProfile(response.data.user);
      setFormData({
        first_name: response.data.user.first_name,
        last_name: response.data.user.last_name,
        phone_number: response.data.user.phone_number || '',
        email: response.data.user.email,
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const response = await api.updateProfile(formData);
    setSaving(false);

    if (response.error) {
      setError(response.error);
    } else {
      setSuccess('Profile updated successfully');
      setProfile(response.data!.user);
      await refreshUser();
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleGoogleLink = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setLinkError('');
    setLinkSuccess('');

    const response = await api.linkOAuthAccount('google', credentialResponse.credential);
    if (response.error) {
      setLinkError(response.error);
    } else {
      setLinkSuccess('Google account linked successfully');
      await loadProfile();
      setTimeout(() => setLinkSuccess(''), 3000);
    }
  };

  const handleMicrosoftLink = async () => {
    setLinkError('');
    setLinkSuccess('');

    try {
      const result = await msalInstance.loginPopup(loginRequest);
      if (result.idToken) {
        const response = await api.linkOAuthAccount('microsoft', result.idToken);
        if (response.error) {
          setLinkError(response.error);
        } else {
          setLinkSuccess('Microsoft account linked successfully');
          await loadProfile();
          setTimeout(() => setLinkSuccess(''), 3000);
        }
      }
    } catch (err: any) {
      if (err.errorCode !== 'user_cancelled') {
        setLinkError('Microsoft sign-in failed');
      }
    }
  };

  if (!user) return null;

  const isLocal = profile?.auth_provider === 'local';
  const hasOAuthLinked = !!profile?.provider_id;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-2xl mx-auto p-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">My Profile</h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Info (read-only) */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Role</span>
                  <p className="font-medium text-gray-900 capitalize">{profile?.role}</p>
                </div>
                <div>
                  <span className="text-gray-500">Sign-in Method</span>
                  <p className="font-medium text-gray-900 capitalize">
                    {profile?.auth_provider === 'local' && !hasOAuthLinked && 'Password'}
                    {profile?.auth_provider === 'google' && 'Google'}
                    {profile?.auth_provider === 'microsoft' && 'Microsoft'}
                    {profile?.auth_provider === 'local' && hasOAuthLinked && 'Password + OAuth'}
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Profile */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
              <form onSubmit={handleSave} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
                )}
                {success && (
                  <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">{success}</div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="input"
                    required
                    disabled={!isLocal}
                  />
                  {!isLocal && (
                    <p className="text-xs text-gray-500 mt-1">Email is managed by your OAuth provider</p>
                  )}
                </div>

                <div>
                  <label className="label">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone_number: e.target.value }))}
                    className="input"
                    placeholder="e.g., +1234567890"
                  />
                </div>

                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>

            {/* Password Section (local users only) */}
            {isLocal && (
              <div className="card">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Password</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Change your password used for email/password sign-in.
                </p>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="btn-secondary"
                >
                  Change Password
                </button>
              </div>
            )}

            {/* Link OAuth Account (local users without OAuth linked) */}
            {isLocal && !hasOAuthLinked && (
              <div className="card">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Link OAuth Account</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Link a Google or Microsoft account for faster sign-in. You can still use your password.
                </p>

                {linkError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{linkError}</div>
                )}
                {linkSuccess && (
                  <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4">{linkSuccess}</div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <GoogleLogin
                    onSuccess={handleGoogleLink}
                    onError={() => setLinkError('Google sign-in failed')}
                    text="signin_with"
                    shape="rectangular"
                    width="200"
                  />
                  <button
                    onClick={handleMicrosoftLink}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 21 21">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Link Microsoft
                  </button>
                </div>
              </div>
            )}

            {hasOAuthLinked && (
              <div className="card">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Linked Account</h3>
                <p className="text-sm text-gray-600">
                  Your account is linked to <span className="font-medium capitalize">{profile?.auth_provider}</span> for sign-in.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
}
