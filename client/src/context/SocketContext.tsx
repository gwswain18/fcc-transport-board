import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import {
  TransporterStatusRecord,
  TransportRequest,
  AlertData,
  CycleTimeAlert,
  BreakAlert,
  TransporterOffline,
  ActiveDispatcher,
  AlertSettings,
} from '../types';
import {
  playJobAssignmentBeep,
  playCycleTimeAlertBeep,
  playHelpRequestBeep,
  initAudioContext,
} from '../utils/audioNotifications';

export interface HelpAlert {
  id?: number;
  user_id: number;
  request_id?: number;
  message?: string;
  first_name?: string;
  last_name?: string;
  origin_floor?: string;
  room_number?: string;
  created_at?: string;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  transporterStatuses: TransporterStatusRecord[];
  requests: TransportRequest[];
  alerts: AlertData[];
  cycleTimeAlerts: CycleTimeAlert[];
  breakAlerts: BreakAlert[];
  offlineAlerts: TransporterOffline[];
  helpAlerts: HelpAlert[];
  activeDispatchers: ActiveDispatcher[];
  alertSettings: AlertSettings | null;
  requireExplanation: boolean;
  dismissAlert: (requestId: number, explanation?: string) => void;
  dismissCycleAlert: (requestId: number, explanation?: string) => void;
  dismissBreakAlert: (userId: number, explanation?: string) => void;
  dismissOfflineAlert: (userId: number, explanation?: string) => void;
  dismissHelpAlert: (alertId: number) => void;
  refreshData: () => void;
  requestHelp: (requestId?: number, message?: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [transporterStatuses, setTransporterStatuses] = useState<TransporterStatusRecord[]>([]);
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [cycleTimeAlerts, setCycleTimeAlerts] = useState<CycleTimeAlert[]>([]);
  const [breakAlerts, setBreakAlerts] = useState<BreakAlert[]>([]);
  const [offlineAlerts, setOfflineAlerts] = useState<TransporterOffline[]>([]);
  const [helpAlerts, setHelpAlerts] = useState<HelpAlert[]>([]);
  const [activeDispatchers, setActiveDispatchers] = useState<ActiveDispatcher[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());
  const [recentlyCompleted, setRecentlyCompleted] = useState<Map<number, number>>(new Map());
  const [completedAlerts, setCompletedAlerts] = useState<CycleTimeAlert[]>([]);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const requireExplanation = alertSettings?.require_explanation_on_dismiss ?? false;

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      return;
    }

    // In production, connect to the API server URL
    // In development, use relative path (Vite proxy handles it)
    let socketUrl: string | undefined = undefined;
    if (import.meta.env.VITE_API_URL) {
      // Remove /api suffix and ensure valid URL
      const apiUrl = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
      try {
        const url = new URL(apiUrl);
        socketUrl = url.origin;
      } catch {
        console.error('Invalid VITE_API_URL:', import.meta.env.VITE_API_URL);
      }
    }
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    // Transporter status events
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

    // Request events
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
      // Play sound if assigned to current user
      if (request.assigned_to === user?.id) {
        playJobAssignmentBeep();
      }
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

      // Track recently completed requests to keep their alerts visible for 30 seconds
      if (request.status === 'complete') {
        setRecentlyCompleted((prev) => {
          const next = new Map(prev);
          next.set(request.id, Date.now());
          return next;
        });

        // Preserve cycle alert for this completed request
        setCycleTimeAlerts((currentAlerts) => {
          const alertForRequest = currentAlerts.find((a) => a.request_id === request.id);
          if (alertForRequest) {
            setCompletedAlerts((prev) => {
              // Don't add duplicate
              if (prev.some((a) => a.request_id === request.id)) return prev;
              return [...prev, alertForRequest];
            });
          }
          return currentAlerts;
        });

        // Clear from recently completed after 30 seconds
        setTimeout(() => {
          setRecentlyCompleted((prev) => {
            const next = new Map(prev);
            next.delete(request.id);
            return next;
          });
          // Also remove from completed alerts
          setCompletedAlerts((prev) => prev.filter((a) => a.request_id !== request.id));
        }, 30000);
      }
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

    // Alert events
    newSocket.on('alert_triggered', (alert: AlertData) => {
      if (!dismissedAlerts.has(alert.request_id)) {
        setAlerts((prev) => {
          const exists = prev.some((a) => a.request_id === alert.request_id);
          if (exists) return prev;
          return [...prev, alert];
        });
      }
    });

    // Cycle time alerts
    newSocket.on('cycle_time_alert', (alert: CycleTimeAlert) => {
      setCycleTimeAlerts((prev) => {
        const exists = prev.some((a) => a.request_id === alert.request_id);
        if (exists) {
          return prev.map((a) => (a.request_id === alert.request_id ? alert : a));
        }
        return [...prev, alert];
      });
      // Play sound if alert is for current user's job
      // Check by looking up the request in our state
      setRequests((currentRequests) => {
        const alertRequest = currentRequests.find((r) => r.id === alert.request_id);
        if (alertRequest?.assigned_to === user?.id) {
          playCycleTimeAlertBeep();
        }
        return currentRequests; // Return unchanged
      });
    });

    // Break alerts
    newSocket.on('break_alert', (alert: BreakAlert) => {
      setBreakAlerts((prev) => {
        const exists = prev.some((a) => a.user_id === alert.user_id);
        if (exists) {
          return prev.map((a) => (a.user_id === alert.user_id ? alert : a));
        }
        return [...prev, alert];
      });
    });

    // Transporter offline alerts
    newSocket.on('transporter_offline', (alert: TransporterOffline) => {
      setOfflineAlerts((prev) => {
        const exists = prev.some((a) => a.user_id === alert.user_id);
        if (exists) return prev;
        return [...prev, alert];
      });
    });

    // Help requested alerts
    newSocket.on('help_requested', (alert: HelpAlert) => {
      setHelpAlerts((prev) => {
        const exists = prev.some((a) =>
          (a.id && alert.id && a.id === alert.id) ||
          (a.user_id === alert.user_id && a.request_id === alert.request_id && a.created_at === alert.created_at)
        );
        if (exists) return prev;
        return [...prev, alert];
      });
      playHelpRequestBeep();
    });

    // Help resolved — remove from all clients
    newSocket.on('help_resolved', (data: { help_request_id: number }) => {
      setHelpAlerts((prev) => prev.filter((a) => a.id !== data.help_request_id));
    });

    // Dispatcher changes
    newSocket.on('dispatcher_changed', (data: { dispatchers: ActiveDispatcher[] }) => {
      setActiveDispatchers(data.dispatchers);
    });

    // Alert settings changes
    newSocket.on('alert_settings_changed', (settings: AlertSettings) => {
      setAlertSettings(settings);
    });

    // Auto-assign timeout
    newSocket.on('auto_assign_timeout', (data: { request_id: number; old_assignee: number; new_assignee?: number }) => {
      console.log('Auto-assign timeout:', data);
      // Could show a notification here
    });

    setSocket(newSocket);

    // Start heartbeat
    heartbeatInterval.current = setInterval(() => {
      newSocket.emit('heartbeat');
    }, HEARTBEAT_INTERVAL);

    return () => {
      newSocket.disconnect();
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [user]);

  const dismissAlert = useCallback((requestId: number, explanation?: string) => {
    setDismissedAlerts((prev) => new Set([...prev, requestId]));
    setAlerts((prev) => prev.filter((a) => a.request_id !== requestId));
    if (socket) {
      socket.emit('timeout_alert_dismissed', { request_id: requestId, explanation });
    }
  }, [socket]);

  const dismissCycleAlert = useCallback((requestId: number, explanation?: string) => {
    setCycleTimeAlerts((prev) => prev.filter((a) => a.request_id !== requestId));
    setCompletedAlerts((prev) => prev.filter((a) => a.request_id !== requestId));
    if (socket) {
      socket.emit('cycle_alert_dismissed', { request_id: requestId, explanation });
    }
  }, [socket]);

  const dismissBreakAlert = useCallback((userId: number, explanation?: string) => {
    setBreakAlerts((prev) => prev.filter((a) => a.user_id !== userId));
    if (socket) {
      socket.emit('break_alert_dismissed', { user_id: userId, explanation });
    }
  }, [socket]);

  const dismissOfflineAlert = useCallback((userId: number, explanation?: string) => {
    setOfflineAlerts((prev) => prev.filter((a) => a.user_id !== userId));
    if (socket) {
      socket.emit('offline_alert_dismissed', { user_id: userId, explanation });
    }
  }, [socket]);

  const dismissHelpAlert = useCallback((alertId: number) => {
    setHelpAlerts((prev) => prev.filter((a) => (a.id || a.user_id) !== alertId));
    if (socket) {
      socket.emit('help_resolved', { help_request_id: alertId });
    }
  }, [socket]);

  const requestHelp = useCallback((requestId?: number, message?: string) => {
    if (socket) {
      socket.emit('help_requested', { request_id: requestId, message });
    }
  }, [socket]);

  const refreshData = async () => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const [statusRes, requestRes, dispatcherRes, alertSettingsRes] = await Promise.all([
      fetch(`${apiBase}/status`, { credentials: 'include' }).then((r) => r.ok ? r.json() : { statuses: [] }),
      fetch(`${apiBase}/requests`, { credentials: 'include' }).then((r) => r.ok ? r.json() : { requests: [] }),
      fetch(`${apiBase}/dispatchers/active`, { credentials: 'include' }).then((r) => r.ok ? r.json() : { dispatchers: [] }).catch(() => ({ dispatchers: [] })),
      fetch(`${apiBase}/config/alert_settings`, { credentials: 'include' }).then((r) => r.ok ? r.json() : { value: null }).catch(() => ({ value: null })),
    ]);

    if (statusRes.statuses) {
      setTransporterStatuses(statusRes.statuses);
    }
    if (requestRes.requests) {
      setRequests(requestRes.requests);
    }
    if (dispatcherRes.dispatchers) {
      setActiveDispatchers(dispatcherRes.dispatchers);
    }
    if (alertSettingsRes.value) {
      setAlertSettings(alertSettingsRes.value);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  // Initialize audio context on first user interaction (required by browsers)
  useEffect(() => {
    const handleUserInteraction = () => {
      initAudioContext();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Combine active cycle alerts with preserved alerts for recently completed requests
  // recentlyCompleted is used to track which requests recently finished (for 30-second alert window)
  const visibleCycleAlerts = [
    ...cycleTimeAlerts,
    ...completedAlerts.filter(
      (ca) => !cycleTimeAlerts.some((a) => a.request_id === ca.request_id) &&
        recentlyCompleted.has(ca.request_id)
    ),
  ];

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        transporterStatuses,
        requests,
        alerts,
        cycleTimeAlerts: visibleCycleAlerts,
        breakAlerts,
        offlineAlerts,
        helpAlerts,
        activeDispatchers,
        alertSettings,
        requireExplanation,
        dismissAlert,
        dismissCycleAlert,
        dismissBreakAlert,
        dismissOfflineAlert,
        dismissHelpAlert,
        refreshData,
        requestHelp,
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
