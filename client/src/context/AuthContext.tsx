import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, ShiftLog } from '../types';
import { api } from '../utils/api';

interface AuthContextType {
  user: User | null;
  activeShift: ShiftLog | null;
  loading: boolean;
  needsSecretarySession: boolean;
  clearNeedsSecretarySession: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsShiftStart?: boolean; isPending?: boolean; isSecretary?: boolean }>;
  oauthLogin: (provider: string, idToken: string) => Promise<{ success: boolean; error?: string; needsShiftStart?: boolean; isPending?: boolean; isSecretary?: boolean }>;
  logout: () => Promise<void>;
  setActiveShift: (shift: ShiftLog | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSecretarySession, setNeedsSecretarySession] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const response = await api.me();
    if (response.data?.user) {
      const userData = { ...response.data.user };
      // Merge secretary session names into user object
      if (response.data.secretarySession) {
        userData.first_name = response.data.secretarySession.session_first_name;
        userData.last_name = response.data.secretarySession.session_last_name;
      }
      setUser(userData);
      if (response.data.activeShift) {
        setActiveShift(response.data.activeShift);
      }
      if (response.data.needsSecretarySession) {
        setNeedsSecretarySession(true);
      }
    }
    setLoading(false);
  };

  const handleLoginResponse = (response: { data?: { user: User; activeShift?: ShiftLog; isPending?: boolean; isSecretary?: boolean }; error?: string }) => {
    if (response.data?.user) {
      setUser(response.data.user);

      // Check if pending approval
      if (response.data.isPending) {
        return { success: true, isPending: true };
      }

      // Check if secretary needs session setup
      if (response.data.isSecretary) {
        return { success: true, isSecretary: true };
      }

      // Check if transporter needs to start shift
      if (response.data.user.role === 'transporter') {
        if (response.data.activeShift) {
          setActiveShift(response.data.activeShift);
          return { success: true };
        } else {
          return { success: true, needsShiftStart: true };
        }
      }

      return { success: true };
    }
    return { success: false, error: response.error };
  };

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    return handleLoginResponse(response as any);
  };

  const oauthLogin = async (provider: string, idToken: string) => {
    const response = await api.oauthLogin(provider, idToken);
    return handleLoginResponse(response as any);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setActiveShift(null);
    setNeedsSecretarySession(false);
  };

  const clearNeedsSecretarySession = () => {
    setNeedsSecretarySession(false);
  };

  const refreshUser = async () => {
    const response = await api.me();
    if (response.data?.user) {
      const userData = { ...response.data.user };
      if (response.data.secretarySession) {
        userData.first_name = response.data.secretarySession.session_first_name;
        userData.last_name = response.data.secretarySession.session_last_name;
      }
      setUser(userData);
      if (response.data.activeShift) {
        setActiveShift(response.data.activeShift);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, activeShift, loading, needsSecretarySession, clearNeedsSecretarySession, login, oauthLogin, logout, setActiveShift, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
