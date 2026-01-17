import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Header() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
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
              to="/dispatcher"
              className="text-gray-600 hover:text-gray-900 px-3 py-2"
            >
              Board
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
                to="/manager"
                className="text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                Dashboard
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

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
