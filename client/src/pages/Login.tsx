import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import ShiftStartModal from '../components/transporter/ShiftStartModal';
import DispatcherLoginModal from '../components/dispatcher/DispatcherLoginModal';
import { Floor } from '../types';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showDispatcherModal, setShowDispatcherModal] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [dispatcherLoading, setDispatcherLoading] = useState(false);
  const [hasPrimaryDispatcher, setHasPrimaryDispatcher] = useState(false);
  const [primaryDispatcherName, setPrimaryDispatcherName] = useState<string | undefined>();
  const { login, user, setActiveShift } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in or handle post-login flow
  useEffect(() => {
    const handleDispatcherLogin = async () => {
      // Fetch active dispatchers to check if primary exists
      const response = await api.getActiveDispatchers();
      if (response.data?.dispatchers) {
        const dispatchers = response.data.dispatchers;
        const primary = dispatchers.find((d: { is_primary: boolean }) => d.is_primary);
        setHasPrimaryDispatcher(!!primary);
        if (primary) {
          setPrimaryDispatcherName(`${primary.first_name} ${primary.last_name}`);
        }
      }
      setShowDispatcherModal(true);
    };

    if (user && !showShiftModal && !showDispatcherModal) {
      // Check if dispatcher/supervisor needs to set up (NOT manager)
      if ((user.role === 'dispatcher' || user.role === 'supervisor') && !loading) {
        handleDispatcherLogin();
        return;
      }
      const roleRoutes: Record<string, string> = {
        transporter: '/transporter',
        dispatcher: '/dashboard',
        supervisor: '/supervisor',
        manager: '/analytics',
      };
      navigate(roleRoutes[user.role] || '/');
    }
  }, [user, navigate, showShiftModal, showDispatcherModal, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error || 'Login failed');
      setLoading(false);
    } else if (result.needsShiftStart) {
      // Transporter needs to start shift
      setLoading(false);
      setShowShiftModal(true);
    }
    // Otherwise, the useEffect will handle navigation (including dispatcher modal)
  };

  const handleStartShift = async (data: { extension?: string; floor_assignment?: Floor }) => {
    setShiftLoading(true);
    const response = await api.startShift(data);
    setShiftLoading(false);

    if (response.data?.shift) {
      setActiveShift(response.data.shift);
      setShowShiftModal(false);
      navigate('/transporter');
    } else {
      setError(response.error || 'Failed to start shift');
    }
  };

  const handleSkipShift = () => {
    // Allow login without starting shift (they can start it later)
    setShowShiftModal(false);
    navigate('/transporter');
  };

  const handleBecomePrimary = async (contactInfo?: string) => {
    setDispatcherLoading(true);

    const response = await api.setPrimaryDispatcher(contactInfo);
    if (response.error) {
      setError(response.error);
      setDispatcherLoading(false);
      return;
    }

    setDispatcherLoading(false);
    setShowDispatcherModal(false);
    navigate('/dashboard');
  };

  const handleJoinAsSecondary = async (contactInfo?: string) => {
    setDispatcherLoading(true);

    const response = await api.registerAsDispatcher(contactInfo);
    if (response.error) {
      setError(response.error);
      setDispatcherLoading(false);
      return;
    }

    setDispatcherLoading(false);
    setShowDispatcherModal(false);
    navigate('/dashboard');
  };

  const handleSkipDispatcherSetup = () => {
    setShowDispatcherModal(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">FCC Transport Board</h1>
          <p className="text-gray-600 mt-2">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-lg font-semibold"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link
            to="/forgot-password"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Forgot your password?
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Mother-Baby Unit Patient Transport System
          </p>
        </div>
      </div>

      <ShiftStartModal
        isOpen={showShiftModal}
        onClose={handleSkipShift}
        onStart={handleStartShift}
        loading={shiftLoading}
      />

      <DispatcherLoginModal
        isOpen={showDispatcherModal}
        hasPrimaryDispatcher={hasPrimaryDispatcher}
        primaryDispatcherName={primaryDispatcherName}
        onBecomePrimary={handleBecomePrimary}
        onJoinAsSecondary={handleJoinAsSecondary}
        onClose={handleSkipDispatcherSetup}
        loading={dispatcherLoading}
      />
    </div>
  );
}
