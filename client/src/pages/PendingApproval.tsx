import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PendingApproval() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // If not logged in or already approved, redirect
  if (!user) {
    navigate('/login');
    return null;
  }

  if (user.approval_status === 'approved') {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>

        <p className="text-gray-600 mb-6">
          Hi <span className="font-medium">{user.first_name}</span>, your account has been created but
          requires manager approval before you can access the system.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="text-sm text-gray-500">
            <div className="flex justify-between py-1">
              <span>Name:</span>
              <span className="font-medium text-gray-900">{user.first_name} {user.last_name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Email:</span>
              <span className="font-medium text-gray-900">{user.email}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Status:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Pending
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          A manager will review your request and assign you a role. You'll be able to sign in once approved.
        </p>

        <button
          onClick={handleLogout}
          className="w-full btn-secondary py-2.5"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
