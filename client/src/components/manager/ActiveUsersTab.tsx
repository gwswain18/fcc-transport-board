import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';

interface ActiveUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_temp_account: boolean;
  login_time: string;
  phone_extension?: string;
}

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  manager: { label: 'Manager', className: 'bg-purple-100 text-purple-700' },
  supervisor: { label: 'Supervisor', className: 'bg-blue-100 text-blue-700' },
  dispatcher: { label: 'Dispatcher', className: 'bg-indigo-100 text-indigo-700' },
  secretary: { label: 'Secretary', className: 'bg-teal-100 text-teal-700' },
  transporter: { label: 'Transporter', className: 'bg-green-100 text-green-700' },
};

function formatDuration(loginTime: string): string {
  const diffMs = Date.now() - new Date(loginTime).getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return 'Just now';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ActiveUsersTab() {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    const response = await api.getActiveUsers();
    if (response.data?.users) {
      setUsers(response.data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
    const interval = setInterval(loadUsers, 30000);
    return () => clearInterval(interval);
  }, [loadUsers]);

  const handleEndSession = async (user: ActiveUser) => {
    if (!confirm(`End ${user.first_name} ${user.last_name}'s session? They will be locked out for 1 hour.`)) {
      return;
    }
    setEnding(user.id);
    await api.endUserSession(user.id);
    await loadUsers();
    setEnding(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Active Users
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({users.length} online)
          </span>
        </h2>
        <button
          onClick={loadUsers}
          className="text-sm text-primary hover:text-primary-600"
        >
          Refresh
        </button>
      </div>

      {users.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No users currently online</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Login Time</th>
                <th className="pb-2 font-medium">Duration</th>
                <th className="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const badge = ROLE_BADGES[user.role] || { label: user.role, className: 'bg-gray-100 text-gray-700' };
                return (
                  <tr key={user.id} className="border-b border-gray-100">
                    <td className="py-3 font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                      {user.phone_extension && (
                        <span className="ml-1 text-xs text-gray-500">Ext. {user.phone_extension}</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">{formatTime(user.login_time)}</td>
                    <td className="py-3 text-gray-600">{formatDuration(user.login_time)}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleEndSession(user)}
                        disabled={ending === user.id}
                        className="text-xs px-3 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        {ending === user.id ? 'Ending...' : 'End Session'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
