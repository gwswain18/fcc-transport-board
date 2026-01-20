import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, ShiftLog } from '../types';
import { api } from '../utils/api';

interface AuthContextType {
  user: User | null;
  activeShift: ShiftLog | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsShiftStart?: boolean }>;
  logout: () => Promise<void>;
  setActiveShift: (shift: ShiftLog | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const response = await api.me();
    if (response.data?.user) {
      setUser(response.data.user);
      if (response.data.activeShift) {
        setActiveShift(response.data.activeShift);
      }
    }
    setLoading(false);
  };

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    if (response.data?.user) {
      setUser(response.data.user);

      // Check if transporter needs to start shift
      if (response.data.user.role === 'transporter') {
        if (response.data.activeShift) {
          setActiveShift(response.data.activeShift);
          return { success: true };
        } else {
          // No active shift - prompt to start one
          return { success: true, needsShiftStart: true };
        }
      }

      return { success: true };
    }
    return { success: false, error: response.error };
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setActiveShift(null);
  };

  const refreshUser = async () => {
    const response = await api.me();
    if (response.data?.user) {
      setUser(response.data.user);
      if (response.data.activeShift) {
        setActiveShift(response.data.activeShift);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, activeShift, loading, login, logout, setActiveShift, refreshUser }}>
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
