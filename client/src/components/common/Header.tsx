import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate, Link } from 'react-router-dom';
import DateTimeDisplay from './DateTimeDisplay';
import PasswordChangeModal from './PasswordChangeModal';
import MuteToggle from './MuteToggle';

export default function Header() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">FCC Transport</h1>
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </div>

          <nav className="hidden md:flex items-center space-x-4">
            {(user.role === 'dispatcher' ||
              user.role === 'supervisor' ||
              user.role === 'manager') && (
              <Link
                to="/dashboard"
                className="text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                Dashboard
              </Link>
            )}
            {(user.role === 'supervisor' || user.role === 'manager') && (
              <Link
                to="/supervisor"
                className="text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                Reports
              </Link>
            )}
            {user.role === 'manager' && (
              <>
                <Link
                  to="/analytics"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2"
                >
                  Analytics
                </Link>
                <Link
                  to="/manager/users"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2"
                >
                  Users
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center space-x-6">
            <MuteToggle />
            <DateTimeDisplay />
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 focus:outline-none"
              >
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    showUserMenu ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowPasswordModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Change Password
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
}
