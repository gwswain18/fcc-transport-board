import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../../utils/api';
import DateTimeDisplay from './DateTimeDisplay';
import MuteToggle from './MuteToggle';
import DarkModeToggle from './DarkModeToggle';

export default function Header() {
  const { user, logout } = useAuth();
  const { connected, refreshData } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'manager') return;

    const loadPendingCount = () => {
      api.getPendingCount().then((res) => {
        if (res.data?.count !== undefined) {
          setPendingCount(res.data.count);
        }
      });
    };

    loadPendingCount();
    // Refresh when the tab regains focus so the badge doesn't go stale
    window.addEventListener('focus', loadPendingCount);
    return () => window.removeEventListener('focus', loadPendingCount);
  }, [user?.role]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    // End dispatcher session before logging out so they don't appear as a ghost
    if (user && (user.role === 'dispatcher' || user.role === 'supervisor')) {
      await api.endDispatcherSession();
    }
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <>
      <header className="bg-primary shadow-lg border-b border-primary-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4 min-w-0">
            <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
              <img
                src="/logo.png"
                alt="Northside Hospital Logo"
                className="h-8 md:h-10 w-auto bg-white rounded p-1 flex-shrink-0"
              />
              <h1 className="text-lg md:text-xl font-bold text-white whitespace-nowrap">FCC Transport</h1>
            </div>
            <div
              role="status"
              aria-label={connected ? 'Connected' : 'Disconnected'}
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-400' : 'bg-red-400'
              }`}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </div>

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10 text-secondary-200 hover:text-white"
            aria-label="Toggle menu"
          >
            {showMobileMenu ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <nav className="hidden md:flex items-center space-x-4">
            {(user.role === 'dispatcher' ||
              user.role === 'supervisor' ||
              user.role === 'manager') && (
              <Link
                to="/dashboard"
                className={isActive('/dashboard') ? 'text-accent font-bold px-3 py-2 transition-colors' : 'text-secondary-200 hover:text-white px-3 py-2 transition-colors'}
              >
                Dashboard
              </Link>
            )}
            {(user.role === 'dispatcher' || user.role === 'supervisor' || user.role === 'manager') && (
              <Link
                to="/supervisor"
                className={isActive('/supervisor') ? 'text-accent font-bold px-3 py-2 transition-colors' : 'text-secondary-200 hover:text-white px-3 py-2 transition-colors'}
              >
                Summary
              </Link>
            )}
            {user.role === 'manager' && (
              <>
                <Link
                  to="/analytics"
                  className={isActive('/analytics') ? 'text-accent font-bold px-3 py-2 transition-colors' : 'text-secondary-200 hover:text-white px-3 py-2 transition-colors'}
                >
                  Analytics
                </Link>
                <Link
                  to="/manager/users"
                  className={`${isActive('/manager/users') ? 'text-accent font-bold' : 'text-secondary-200 hover:text-white'} px-3 py-2 transition-colors relative`}
                >
                  Users
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/manager/settings"
                  className={isActive('/manager/settings') ? 'text-accent font-bold px-3 py-2 transition-colors' : 'text-secondary-200 hover:text-white px-3 py-2 transition-colors'}
                >
                  Settings
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center space-x-1 md:space-x-6 flex-shrink-0">
            <MuteToggle className="text-secondary-200 hover:text-white" />
            <DarkModeToggle className="text-secondary-200 hover:text-white" />
            <DateTimeDisplay className="hidden md:block text-secondary-200" />
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-secondary-200 hover:text-white disabled:opacity-50"
              title="Refresh data"
              aria-label="Refresh data"
            >
              <svg
                className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 md:space-x-3 p-1 focus:outline-none"
                aria-label="User menu"
              >
                {/* Phone: person icon only — the full name/role block wider than
                    the screen was what made every page scroll sideways */}
                <svg
                  className="w-6 h-6 text-secondary-200 md:hidden"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="hidden md:block text-right min-w-0">
                  <p className="text-sm font-medium text-white truncate max-w-[16rem]">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-secondary-200 capitalize">{user.role}</p>
                </div>
                <svg
                  className={`hidden md:block w-4 h-4 text-secondary-200 transition-transform ${
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
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-alabaster py-1 z-20">
                    {/* On phones the header shows only an icon, so identify the
                        signed-in user here */}
                    <div className="md:hidden px-4 py-2 border-b border-alabaster">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/profile');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-smoke"
                    >
                      My Profile
                    </button>
                    <hr className="my-1 border-alabaster" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-smoke"
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

      {showMobileMenu && (
        <>
        <div
          className="fixed inset-0 z-10 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
        <nav className="relative z-20 md:hidden bg-primary-700 border-b border-primary-600">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col space-y-1">
            {(user.role === 'dispatcher' ||
              user.role === 'supervisor' ||
              user.role === 'manager') && (
              <Link
                to="/dashboard"
                onClick={() => setShowMobileMenu(false)}
                className={isActive('/dashboard') ? 'text-accent font-bold hover:bg-white/10 px-3 py-2 rounded-lg transition-colors' : 'text-secondary-200 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-colors'}
              >
                Dashboard
              </Link>
            )}
            {(user.role === 'dispatcher' || user.role === 'supervisor' || user.role === 'manager') && (
              <Link
                to="/supervisor"
                onClick={() => setShowMobileMenu(false)}
                className={isActive('/supervisor') ? 'text-accent font-bold hover:bg-white/10 px-3 py-2 rounded-lg transition-colors' : 'text-secondary-200 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-colors'}
              >
                Summary
              </Link>
            )}
            {user.role === 'manager' && (
              <>
                <Link
                  to="/analytics"
                  onClick={() => setShowMobileMenu(false)}
                  className={isActive('/analytics') ? 'text-accent font-bold hover:bg-white/10 px-3 py-2 rounded-lg transition-colors' : 'text-secondary-200 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-colors'}
                >
                  Analytics
                </Link>
                <Link
                  to="/manager/users"
                  onClick={() => setShowMobileMenu(false)}
                  className={`${isActive('/manager/users') ? 'text-accent font-bold' : 'text-secondary-200 hover:text-white'} hover:bg-white/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-2`}
                >
                  Users
                  {pendingCount > 0 && (
                    <span className="bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/manager/settings"
                  onClick={() => setShowMobileMenu(false)}
                  className={isActive('/manager/settings') ? 'text-accent font-bold hover:bg-white/10 px-3 py-2 rounded-lg transition-colors' : 'text-secondary-200 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-colors'}
                >
                  Settings
                </Link>
              </>
            )}
          </div>
        </nav>
        </>
      )}

    </>
  );
}
