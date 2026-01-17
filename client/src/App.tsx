import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import TransporterView from './pages/TransporterView';
import DispatcherView from './pages/DispatcherView';
import SupervisorView from './pages/SupervisorView';
import ManagerDashboard from './pages/ManagerDashboard';
import UserManagement from './pages/UserManagement';

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate view based on role
    const roleRoutes: Record<string, string> = {
      transporter: '/transporter',
      dispatcher: '/dispatcher',
      supervisor: '/supervisor',
      manager: '/manager',
    };
    return <Navigate to={roleRoutes[user.role] || '/login'} replace />;
  }

  return <>{children}</>;
}

function RoleBasedRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const roleRoutes: Record<string, string> = {
    transporter: '/transporter',
    dispatcher: '/dispatcher',
    supervisor: '/supervisor',
    manager: '/manager',
  };

  return <Navigate to={roleRoutes[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RoleBasedRedirect />} />

      <Route
        path="/transporter"
        element={
          <ProtectedRoute>
            <TransporterView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dispatcher"
        element={
          <ProtectedRoute allowedRoles={['dispatcher', 'supervisor', 'manager']}>
            <DispatcherView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor"
        element={
          <ProtectedRoute allowedRoles={['supervisor', 'manager']}>
            <SupervisorView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager"
        element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager/users"
        element={
          <ProtectedRoute allowedRoles={['manager']}>
            <UserManagement />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
