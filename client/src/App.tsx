import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PendingApproval from './pages/PendingApproval';

const TransporterView = lazy(() => import('./pages/TransporterView'));
const DispatcherView = lazy(() => import('./pages/DispatcherView'));
const SupervisorView = lazy(() => import('./pages/SupervisorView'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.approval_status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate view based on role
    const roleRoutes: Record<string, string> = {
      transporter: '/transporter',
      secretary: '/dashboard',
      dispatcher: '/dashboard',
      supervisor: '/supervisor',
      manager: '/analytics',
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.approval_status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  const roleRoutes: Record<string, string> = {
    transporter: '/transporter',
    secretary: '/dashboard',
    dispatcher: '/dashboard',
    supervisor: '/supervisor',
    manager: '/analytics',
  };

  return <Navigate to={roleRoutes[user.role] || '/login'} replace />;
}

const LazyFallback = (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

export default function App() {
  return (
    <Suspense fallback={LazyFallback}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/pending" element={<PendingApproval />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/" element={<RoleBasedRedirect />} />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/transporter"
        element={
          <ProtectedRoute>
            <TransporterView />
          </ProtectedRoute>
        }
      />

      {/* Renamed: Board → Dashboard (DispatcherView) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['secretary', 'dispatcher', 'supervisor', 'manager']}>
            <DispatcherView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor"
        element={
          <ProtectedRoute allowedRoles={['dispatcher', 'supervisor', 'manager']}>
            <SupervisorView />
          </ProtectedRoute>
        }
      />

      {/* Renamed: Dashboard → Analytics (ManagerDashboard) */}
      <Route
        path="/analytics"
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

      <Route
        path="/manager/settings"
        element={
          <ProtectedRoute allowedRoles={['manager']}>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
