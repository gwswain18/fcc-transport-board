import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { TransporterStatusRecord, TransportRequest, AlertData } from '../types';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  transporterStatuses: TransporterStatusRecord[];
  requests: TransportRequest[];
  alerts: AlertData[];
  dismissAlert: (requestId: number) => void;
  refreshData: () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [transporterStatuses, setTransporterStatuses] = useState<TransporterStatusRecord[]>([]);
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = io({
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('transporter_status_changed', (status: TransporterStatusRecord) => {
      setTransporterStatuses((prev) => {
        const index = prev.findIndex((s) => s.user_id === status.user_id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = status;
          return updated;
        }
        return [...prev, status];
      });
    });

    newSocket.on('request_created', (request: TransportRequest) => {
      setRequests((prev) => [...prev, request]);
    });

    newSocket.on('request_assigned', (request: TransportRequest) => {
      setRequests((prev) => {
        const index = prev.findIndex((r) => r.id === request.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = request;
          return updated;
        }
        return prev;
      });
    });

    newSocket.on('request_status_changed', (request: TransportRequest) => {
      setRequests((prev) => {
        const index = prev.findIndex((r) => r.id === request.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = request;
          return updated;
        }
        return prev;
      });
    });

    newSocket.on('request_cancelled', (request: TransportRequest) => {
      setRequests((prev) => {
        const index = prev.findIndex((r) => r.id === request.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = request;
          return updated;
        }
        return prev;
      });
    });

    newSocket.on('alert_triggered', (alert: AlertData) => {
      if (!dismissedAlerts.has(alert.request_id)) {
        setAlerts((prev) => {
          const exists = prev.some((a) => a.request_id === alert.request_id);
          if (exists) return prev;
          return [...prev, alert];
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const dismissAlert = (requestId: number) => {
    setDismissedAlerts((prev) => new Set([...prev, requestId]));
    setAlerts((prev) => prev.filter((a) => a.request_id !== requestId));
  };

  const refreshData = async () => {
    const [statusRes, requestRes] = await Promise.all([
      fetch('/api/status', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/requests', { credentials: 'include' }).then((r) => r.json()),
    ]);

    if (statusRes.statuses) {
      setTransporterStatuses(statusRes.statuses);
    }
    if (requestRes.requests) {
      setRequests(requestRes.requests);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        transporterStatuses,
        requests,
        alerts,
        dismissAlert,
        refreshData,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
