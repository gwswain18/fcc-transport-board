import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { User, UserRole, Floor } from '../types';
import Header from '../components/common/Header';
import Modal from '../components/common/Modal';

const ROLES: UserRole[] = ['transporter', 'dispatcher', 'supervisor', 'manager'];
const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'transporter' as UserRole,
    is_active: true,
    primary_floor: '' as Floor | '',
    phone_number: '',
    include_in_analytics: true,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const response = await api.getUsers();
    if (response.data?.users) {
      setUsers(response.data.users);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate primary_floor for transporters
    if (formData.role === 'transporter' && !formData.primary_floor) {
      setError('Primary floor is required for transporters');
      return;
    }

    setLoading(true);

    if (editingUser) {
      const response = await api.updateUser(editingUser.id, {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: formData.role,
        is_active: formData.is_active,
        primary_floor: formData.primary_floor || undefined,
        phone_number: formData.phone_number || undefined,
        include_in_analytics: formData.include_in_analytics,
      });

      if (response.error) {
        setError(response.error);
        setLoading(false);
        return;
      }
    } else {
      if (!formData.password) {
        setError('Password is required for new users');
        setLoading(false);
        return;
      }

      const response = await api.createUser({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: formData.role,
        primary_floor: formData.primary_floor || undefined,
        phone_number: formData.phone_number || undefined,
        include_in_analytics: formData.include_in_analytics,
      });

      if (response.error) {
        setError(response.error);
        setLoading(false);
        return;
      }
    }

    await loadUsers();
    closeModal();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !newPassword) return;

    setError('');
    setLoading(true);

    const response = await api.resetUserPassword(selectedUserId, newPassword);

    if (response.error) {
      setError(response.error);
      setLoading(false);
      return;
    }

    setResetPasswordModal(false);
    setSelectedUserId(null);
    setNewPassword('');
    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'transporter',
      is_active: true,
      primary_floor: '',
      phone_number: '',
      include_in_analytics: true,
    });
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      primary_floor: user.primary_floor || '',
      phone_number: user.phone_number || '',
      include_in_analytics: user.include_in_analytics ?? true,
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setError('');
    setLoading(false);
  };

  const openResetPasswordModal = (userId: number) => {
    setSelectedUserId(userId);
    setNewPassword('');
    setError('');
    setResetPasswordModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-6xl mx-auto p-4">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
            <button onClick={openCreateModal} className="btn-primary">
              Add User
            </button>
          </div>

          {loading && users.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Role
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Primary Floor
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Phone
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                        {user.is_temp_account && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                            Temp
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary capitalize">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {user.primary_floor || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {user.phone_number || '-'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-primary hover:text-primary-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(user.id)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          Reset Password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Create User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, first_name: e.target.value }))
                }
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, last_name: e.target.value }))
                }
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="input"
              required
            />
          </div>

          {!editingUser && (
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                className="input"
                required={!editingUser}
                minLength={6}
              />
            </div>
          )}

          <div>
            <label className="label">Role</label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  role: e.target.value as UserRole,
                }))
              }
              className="input"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">
              Primary Floor {formData.role === 'transporter' && <span className="text-red-500">*</span>}
            </label>
            <select
              value={formData.primary_floor}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  primary_floor: e.target.value as Floor | '',
                }))
              }
              className="input"
              required={formData.role === 'transporter'}
            >
              <option value="">None</option>
              {FLOORS.map((floor) => (
                <option key={floor} value={floor}>
                  {floor}
                </option>
              ))}
            </select>
            {formData.role === 'transporter' && (
              <p className="text-xs text-gray-500 mt-1">Required for transporters</p>
            )}
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone_number: e.target.value }))
              }
              className="input"
              placeholder="e.g., +1234567890"
            />
            <p className="text-xs text-gray-500 mt-1">For SMS notifications</p>
          </div>

          <div className="space-y-2">
            {editingUser && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Active
                </label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="include_in_analytics"
                checked={formData.include_in_analytics}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, include_in_analytics: e.target.checked }))
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="include_in_analytics" className="text-sm text-gray-700">
                Include in Analytics
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary">
              {loading ? 'Saving...' : editingUser ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetPasswordModal}
        onClose={() => setResetPasswordModal(false)}
        title="Reset Password"
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              required
              minLength={6}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setResetPasswordModal(false)}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
