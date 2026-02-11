import { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import CycleTimeAlert from './CycleTimeAlert';
import AlertDismissalModal from './AlertDismissalModal';
import MuteToggle from './MuteToggle';

type DismissalType = 'timeout' | 'break' | 'offline' | 'cycle';
interface PendingDismissal {
  type: DismissalType;
  id: number;
  details?: string;
}

export default function AlertBanners() {
  const {
    requests,
    alerts,
    cycleTimeAlerts,
    breakAlerts,
    offlineAlerts,
    requireExplanation,
    dismissAlert,
    dismissCycleAlert,
    dismissBreakAlert,
    dismissOfflineAlert,
  } = useSocket();
  const [dismissalModal, setDismissalModal] = useState<PendingDismissal | null>(null);

  const handleDismissTimeoutAlert = (requestId: number, details?: string) => {
    if (requireExplanation) {
      setDismissalModal({ type: 'timeout', id: requestId, details });
    } else {
      dismissAlert(requestId);
    }
  };

  const handleDismissBreakAlert = (userId: number, details?: string) => {
    if (requireExplanation) {
      setDismissalModal({ type: 'break', id: userId, details });
    } else {
      dismissBreakAlert(userId);
    }
  };

  const handleDismissOfflineAlert = (userId: number, details?: string) => {
    if (requireExplanation) {
      setDismissalModal({ type: 'offline', id: userId, details });
    } else {
      dismissOfflineAlert(userId);
    }
  };

  const handleDismissalConfirm = (explanation: string) => {
    if (!dismissalModal) return;
    switch (dismissalModal.type) {
      case 'timeout':
        dismissAlert(dismissalModal.id, explanation);
        break;
      case 'break':
        dismissBreakAlert(dismissalModal.id, explanation);
        break;
      case 'offline':
        dismissOfflineAlert(dismissalModal.id, explanation);
        break;
      case 'cycle':
        dismissCycleAlert(dismissalModal.id, explanation);
        break;
    }
    setDismissalModal(null);
  };

  const hasAnyAlerts = alerts.length > 0 || breakAlerts.length > 0 || offlineAlerts.length > 0 || cycleTimeAlerts.length > 0;

  return (
    <>
      {/* Mute toggle (only show when alerts exist) */}
      {hasAnyAlerts && (
        <div className="bg-gray-800 text-white px-4 py-1">
          <div className="max-w-7xl mx-auto flex items-center justify-end">
            <MuteToggle className="text-white" showLabel />
          </div>
        </div>
      )}

      {/* Timeout Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold">ALERT:</span>
              <span>{alerts.length} request(s) waiting too long</span>
            </div>
            <div className="flex gap-2">
              {alerts.slice(0, 3).map((alert) => (
                <button
                  key={alert.request_id}
                  onClick={() => handleDismissTimeoutAlert(
                    alert.request_id,
                    `${alert.type} - ${alert.request.origin_floor}-${alert.request.room_number}`
                  )}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                >
                  {alert.request.origin_floor}-{alert.request.room_number} (Dismiss)
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Break Alerts */}
      {breakAlerts.length > 0 && (
        <div className="bg-yellow-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold">BREAK ALERT:</span>
              <span>
                {breakAlerts.map((a) => `${a.first_name} ${a.last_name} (${a.minutes_on_break} min)`).join(', ')}
              </span>
            </div>
            <div className="flex gap-2">
              {breakAlerts.map((alert) => (
                <button
                  key={alert.user_id}
                  onClick={() => handleDismissBreakAlert(
                    alert.user_id,
                    `${alert.first_name} ${alert.last_name} on break for ${alert.minutes_on_break} min`
                  )}
                  className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-sm"
                >
                  Dismiss
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Offline Alerts */}
      {offlineAlerts.length > 0 && (
        <div className="bg-gray-700 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold">OFFLINE:</span>
              <span>
                {offlineAlerts.map((a) => `${a.first_name} ${a.last_name}`).join(', ')}
              </span>
            </div>
            <div className="flex gap-2">
              {offlineAlerts.map((alert) => (
                <button
                  key={alert.user_id}
                  onClick={() => handleDismissOfflineAlert(
                    alert.user_id,
                    `${alert.first_name} ${alert.last_name} went offline`
                  )}
                  className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm"
                >
                  Dismiss
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cycle Time Alerts */}
      {cycleTimeAlerts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-2 space-y-2">
          {cycleTimeAlerts.map((alert) => (
            <CycleTimeAlert
              key={alert.request_id}
              alert={alert}
              request={requests.find(r => r.id === alert.request_id)}
              onDismiss={dismissCycleAlert}
            />
          ))}
        </div>
      )}

      {/* Alert Dismissal Modal */}
      <AlertDismissalModal
        isOpen={!!dismissalModal}
        onClose={() => setDismissalModal(null)}
        onConfirm={handleDismissalConfirm}
        alertType={dismissalModal?.type}
        alertDetails={dismissalModal?.details}
      />
    </>
  );
}
