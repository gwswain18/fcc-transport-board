import { CycleTimeAlert as CycleTimeAlertType } from '../../types';

interface CycleTimeAlertProps {
  alert: CycleTimeAlertType;
  onDismiss: (requestId: number, explanation?: string) => void;
}

export default function CycleTimeAlert({ alert, onDismiss }: CycleTimeAlertProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const phaseLabels: Record<string, string> = {
    pending: 'Pending',
    assigned: 'Response',
    accepted: 'En Route',
    en_route: 'Pickup',
    with_patient: 'Transport',
  };

  const overagePercentage = Math.round(
    ((alert.current_seconds - alert.avg_seconds) / alert.avg_seconds) * 100
  );

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-ping" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-yellow-800">
              Cycle Time Alert - Request #{alert.request_id}
            </h4>
            <p className="text-sm text-yellow-700 mt-1">
              <span className="font-medium">{phaseLabels[alert.phase] || alert.phase}</span>
              {' '}phase is taking longer than usual
            </p>
            <div className="mt-2 text-xs text-yellow-600">
              <span>Current: {formatTime(alert.current_seconds)}</span>
              <span className="mx-2">|</span>
              <span>Average: {formatTime(alert.avg_seconds)}</span>
              <span className="mx-2">|</span>
              <span className="font-medium">+{overagePercentage}% over average</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDismiss(alert.request_id)}
          className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
