import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { api } from '../utils/api';
import {
  TransporterStatusRecord,
  TransportRequest,
  AlertData,
  CycleTimeAlert,
  BreakAlert,
  TransporterOffline,
  ActiveDispatcher,
  ActiveSecretary,
  AlertSettings,
  JobRemovedNotification,
  UserNotification,
} from '../types';
import {
  playJobAssignmentBeep,
  playCycleTimeAlertBeep,
  initAudioContext,
} from '../utils/audioNotifications';
import { flushQueue } from '../utils/offlineQueue';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  transporterStatuses: TransporterStatusRecord[];
  requests: TransportRequest[];
  alerts: AlertData[];
  cycleTimeAlerts: CycleTimeAlert[];
  breakAlerts: BreakAlert[];
  offlineAlerts: TransporterOffline[];
  activeDispatchers: ActiveDispatcher[];
  activeSecretaries: ActiveSecretary[];
  alertSettings: AlertSettings | null;
  requireExplanation: boolean;
  requireTransporterExplanation: boolean;
  notesEnabled: boolean;
  jobRemovedNotification: JobRemovedNotification | null;
  missedJobNotifications: UserNotification[];
  reassignmentNotices: { id: number; message: string }[];
  dismissAlert: (requestId: number, explanation?: string) => void;
  dismissCycleAlert: (requestId: number, explanation?: string, phase?: string) => void;
  dismissBreakAlert: (userId: number, explanation?: string) => void;
  dismissOfflineAlert: (userId: number, explanation?: string) => void;
  clearJobRemovedNotification: () => void;
  removeMissedJobNotification: (id: number) => void;
  dismissReassignmentNotice: (id: number) => void;
  refreshData: () => void;
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
  const [activeDispatchers, setActiveDispatchers] = useState<ActiveDispatcher[]>([]);
  const [activeSecretaries, setActiveSecretaries] = useState<ActiveSecretary[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  // Default enabled; corrected on first refreshData and kept live via socket
  const [notesEnabled, setNotesEnabled] = useState(true);
  const [jobRemovedNotification, setJobRemovedNotification] = useState<JobRemovedNotification | null>(null);
  // Persistent missed-job notices (delivered on connect; cleared only by acknowledge)
  const [missedJobNotifications, setMissedJobNotifications] = useState<UserNotification[]>([]);
  // Transient dispatcher-facing banners for auto-reassigned jobs
  const [reassignmentNotices, setReassignmentNotices] = useState<{ id: number; message: string }[]>([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Map<number, number>>(new Map());
  const [completedAlerts, setCompletedAlerts] = useState<CycleTimeAlert[]>([]);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref (not state) so socket handlers always see current dismissals without
  // re-subscribing the socket effect
  const dismissedAlertsRef = useRef<Set<number>>(new Set());
  const pendingTimeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const requireExplanation = alertSettings?.require_explanation_on_dismiss ?? false;
  const requireTransporterExplanation = alertSettings?.require_transporter_explanation_on_dismiss ?? true;

  const userId = user?.id;
  const userRole = user?.role;

  useEffect(() => {
    if (!userId) {
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
        // Invalid VITE_API_URL, falling back to default
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
      setConnected(true);
      flushQueue();
    });

    newSocket.on('disconnect', () => {
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
      setRequests((prev) => {
        // De-dupe: a reconnect replay or refresh overlap can deliver the same
        // request twice
        const index = prev.findIndex((r) => r.id === request.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = request;
          return updated;
        }
        return [...prev, request];
      });
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
      if (request.assigned_to === userId) {
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
        const timeoutId = setTimeout(() => {
          pendingTimeouts.current.delete(timeoutId);
          setRecentlyCompleted((prev) => {
            const next = new Map(prev);
            next.delete(request.id);
            return next;
          });
          // Also remove from completed alerts
          setCompletedAlerts((prev) => prev.filter((a) => a.request_id !== request.id));
        }, 30000);
        pendingTimeouts.current.add(timeoutId);
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
      if (!dismissedAlertsRef.current.has(alert.request_id)) {
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
        if (alertRequest?.assigned_to === userId) {
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

    // Delay note added — clear cycle time alert for this request
    newSocket.on('delay_note_added', (data: { request_id: number; phase?: string }) => {
      setCycleTimeAlerts((prev) => prev.filter((a) => a.request_id !== data.request_id));
      setCompletedAlerts((prev) => prev.filter((a) => a.request_id !== data.request_id));
    });

    // Dispatcher changes
    newSocket.on('dispatcher_changed', (data: { dispatchers: ActiveDispatcher[] }) => {
      setActiveDispatchers(data.dispatchers);
    });

    // Secretary changes
    newSocket.on('secretary_changed', (data: { secretaries: ActiveSecretary[] }) => {
      setActiveSecretaries(data.secretaries);
    });

    // Force logout (from manager ending session)
    newSocket.on('force_logout', () => {
      window.location.href = '/login';
    });

    // Job removed notification (cancel/reassign)
    newSocket.on('job_removed', (notification: JobRemovedNotification) => {
      setJobRemovedNotification(notification);
    });

    // Alert settings changes
    newSocket.on('alert_settings_changed', (settings: AlertSettings) => {
      setAlertSettings(settings);
    });

    // Notes-enabled toggle changes (manager flips it in settings)
    newSocket.on('notes_enabled_changed', (enabled: boolean) => {
      setNotesEnabled(enabled !== false);
    });

    // Auto-assign timeout — show dispatch-side banner that a job was reassigned
    newSocket.on(
      'auto_assign_timeout',
      (data: { request_id: number; old_assignee: number; new_assignee?: number | null; job_summary?: string }) => {
        if (userRole === 'transporter') return;
        const message = data.new_assignee
          ? `Job ${data.job_summary ?? `#${data.request_id}`} reassigned after acceptance timeout`
          : `Job ${data.job_summary ?? `#${data.request_id}`} returned to pending after acceptance timeout (no transporter available)`;
        setReassignmentNotices((prev) => [...prev, { id: data.request_id, message }]);
        // Auto-clear after 30 seconds; the event is also in the audit log
        const timeoutId = setTimeout(() => {
          pendingTimeouts.current.delete(timeoutId);
          setReassignmentNotices((prev) => prev.filter((n) => n.id !== data.request_id));
        }, 30000);
        pendingTimeouts.current.add(timeoutId);
      }
    );

    // Persistent notifications delivered on (re)connect
    newSocket.on('pending_notifications', (data: { notifications: UserNotification[] }) => {
      const missed = (data.notifications || []).filter((n) => n.type === 'missed_job');
      setMissedJobNotifications((prev) => {
        const known = new Set(prev.map((n) => n.id));
        return [...prev, ...missed.filter((n) => !known.has(n.id))];
      });
    });

    // Live missed-job notice (user was connected when the timeout fired)
    newSocket.on('missed_job_notification', (data: { notification: UserNotification }) => {
      setMissedJobNotifications((prev) => {
        if (prev.some((n) => n.id === data.notification.id)) return prev;
        return [...prev, data.notification];
      });
    });

    setSocket(newSocket);

    // Start heartbeat
    heartbeatInterval.current = setInterval(() => {
      newSocket.emit('heartbeat');
    }, HEARTBEAT_INTERVAL);

    // Reconnect and heartbeat immediately when device wakes from sleep/screen lock
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        newSocket.emit('heartbeat');
        if (!newSocket.connected) {
          newSocket.connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('transporter_status_changed');
      newSocket.off('request_created');
      newSocket.off('request_assigned');
      newSocket.off('request_status_changed');
      newSocket.off('request_cancelled');
      newSocket.off('alert_triggered');
      newSocket.off('cycle_time_alert');
      newSocket.off('break_alert');
      newSocket.off('transporter_offline');
      newSocket.off('delay_note_added');
      newSocket.off('dispatcher_changed');
      newSocket.off('secretary_changed');
      newSocket.off('force_logout');
      newSocket.off('job_removed');
      newSocket.off('alert_settings_changed');
      newSocket.off('notes_enabled_changed');
      newSocket.off('auto_assign_timeout');
      newSocket.off('pending_notifications');
      newSocket.off('missed_job_notification');
      newSocket.disconnect();
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      for (const timeoutId of pendingTimeouts.current) {
        clearTimeout(timeoutId);
      }
      pendingTimeouts.current.clear();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // Key on id + role, not the object: auth refreshes rebuild the user object
    // and must not tear down the socket
  }, [userId, userRole]);

  const dismissAlert = useCallback((requestId: number, explanation?: string) => {
    dismissedAlertsRef.current.add(requestId);
    setAlerts((prev) => prev.filter((a) => a.request_id !== requestId));
    if (socket) {
      socket.emit('timeout_alert_dismissed', { request_id: requestId, explanation });
    }
  }, [socket]);

  const dismissCycleAlert = useCallback((requestId: number, explanation?: string, phase?: string) => {
    setCycleTimeAlerts((prev) => prev.filter((a) => a.request_id !== requestId));
    setCompletedAlerts((prev) => prev.filter((a) => a.request_id !== requestId));
    if (socket) {
      socket.emit('cycle_alert_dismissed', { request_id: requestId, explanation, phase });
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

  const clearJobRemovedNotification = useCallback(() => {
    setJobRemovedNotification(null);
  }, []);

  const removeMissedJobNotification = useCallback((id: number) => {
    setMissedJobNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissReassignmentNotice = useCallback((id: number) => {
    setReassignmentNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const refreshData = useCallback(async () => {
    const [statusRes, requestRes, dispatcherRes, secretaryRes, alertSettingsRes, notesEnabledRes, notificationsRes] = await Promise.all([
      api.getStatuses(),
      api.getRequests(),
      api.getActiveDispatchers(),
      api.getActiveSecretaries(),
      api.getConfigByKey('alert_settings'),
      api.getNotesEnabled(),
      api.getMyNotifications(),
    ]);

    if (statusRes.data?.statuses) {
      setTransporterStatuses(statusRes.data.statuses);
    }
    if (requestRes.data?.requests) {
      setRequests(requestRes.data.requests);
    }
    if (dispatcherRes.data?.dispatchers) {
      setActiveDispatchers(dispatcherRes.data.dispatchers);
    }
    if (secretaryRes.data?.secretaries) {
      setActiveSecretaries(secretaryRes.data.secretaries);
    }
    if (alertSettingsRes.data?.value) {
      setAlertSettings(alertSettingsRes.data.value as AlertSettings);
    }
    if (typeof notesEnabledRes.data?.notesEnabled === 'boolean') {
      setNotesEnabled(notesEnabledRes.data.notesEnabled);
    }
    // Fallback for pending notifications in case the socket connected before
    // login state settled (socket delivery marks them delivered, not acknowledged)
    if (notificationsRes.data?.notifications) {
      const missed = notificationsRes.data.notifications.filter((n) => n.type === 'missed_job');
      setMissedJobNotifications((prev) => {
        const known = new Set(prev.map((n) => n.id));
        return [...prev, ...missed.filter((n) => !known.has(n.id))];
      });
    }
  }, []);

  useEffect(() => {
    if (userId) {
      refreshData();
    }
  }, [userId, refreshData]);

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
  const visibleCycleAlerts = useMemo(
    () => [
      ...cycleTimeAlerts,
      ...completedAlerts.filter(
        (ca) => !cycleTimeAlerts.some((a) => a.request_id === ca.request_id) &&
          recentlyCompleted.has(ca.request_id)
      ),
    ],
    [cycleTimeAlerts, completedAlerts, recentlyCompleted]
  );

  // Memoize so consumers only re-render when a value they use actually changes
  const contextValue = useMemo(
    () => ({
      socket,
      connected,
      transporterStatuses,
      requests,
      alerts,
      cycleTimeAlerts: visibleCycleAlerts,
      breakAlerts,
      offlineAlerts,
      activeDispatchers,
      activeSecretaries,
      alertSettings,
      requireExplanation,
      requireTransporterExplanation,
      notesEnabled,
      jobRemovedNotification,
      missedJobNotifications,
      reassignmentNotices,
      dismissAlert,
      dismissCycleAlert,
      dismissBreakAlert,
      dismissOfflineAlert,
      clearJobRemovedNotification,
      removeMissedJobNotification,
      dismissReassignmentNotice,
      refreshData,
    }),
    [
      socket,
      connected,
      transporterStatuses,
      requests,
      alerts,
      visibleCycleAlerts,
      breakAlerts,
      offlineAlerts,
      activeDispatchers,
      activeSecretaries,
      alertSettings,
      requireExplanation,
      requireTransporterExplanation,
      notesEnabled,
      jobRemovedNotification,
      missedJobNotifications,
      reassignmentNotices,
      dismissAlert,
      dismissCycleAlert,
      dismissBreakAlert,
      dismissOfflineAlert,
      clearJobRemovedNotification,
      removeMissedJobNotification,
      dismissReassignmentNotice,
      refreshData,
    ]
  );

  return (
    <SocketContext.Provider value={contextValue}>
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
