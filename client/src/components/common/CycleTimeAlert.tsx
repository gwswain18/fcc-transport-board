import { useState } from 'react';
import { CycleTimeAlert as CycleTimeAlertType, TransportRequest } from '../../types';

interface CycleTimeAlertProps {
  alert: CycleTimeAlertType;
  request?: TransportRequest;
  onDismiss: (requestId: number, reason?: string) => void;
  requireReason?: boolean;
}

export default function CycleTimeAlert({ alert, request, onDismiss, requireReason = true }: CycleTimeAlertProps) {
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');

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

  const handleDismissClick = () => {
    // If transporter already provided a reason, allow quick acknowledge
    if (request?.delay_reason) {
      onDismiss(alert.request_id, `Transporter provided: ${request.delay_reason}`);
    } else if (!requireReason) {
      onDismiss(alert.request_id);
    } else {
      setShowReasonInput(true);
    }
  };

  const handleConfirmDismiss = () => {
    if (!reason.trim()) return;
    onDismiss(alert.request_id, reason.trim());
    setShowReasonInput(false);
    setReason('');
  };

  const handleCancelDismiss = () => {
    setShowReasonInput(false);
    setReason('');
  };

  const quickReasons = [
    'Patient not ready',
    'Elevator delay',
    'Waiting for equipment',
    'Staff coordination',
    'Forgot to press button',
    'Documentation pending',
  ];

  // Build header text with transporter name if available
  const headerText = request?.assignee
    ? `${request.assignee.first_name} ${request.assignee.last_name}`
    : `Request #${alert.request_id}`;

  const locationText = request
    ? ` (${request.origin_floor}-${request.room_number})`
    : '';

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-ping" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-yellow-800">
              Cycle Time Alert - {headerText}{locationText}
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

            {/* Show transporter's delay reason if provided */}
            {request?.delay_reason && (
              <p className="text-sm text-green-700 mt-2 bg-green-50 p-2 rounded">
                <span className="font-medium">Transporter note:</span> {request.delay_reason}
              </p>
            )}
          </div>
        </div>
        {!showReasonInput && (
          <button
            onClick={handleDismissClick}
            className={`text-sm font-medium ${
              request?.delay_reason
                ? 'text-green-600 hover:text-green-800'
                : 'text-yellow-600 hover:text-yellow-800'
            }`}
          >
            {request?.delay_reason ? 'Acknowledge' : 'Dismiss'}
          </button>
        )}
      </div>

      {showReasonInput && (
        <div className="mt-4 border-t border-yellow-200 pt-4">
          <p className="text-sm text-yellow-700 mb-2">Please provide a reason for dismissing this alert:</p>

          <div className="flex flex-wrap gap-2 mb-3">
            {quickReasons.map((quickReason) => (
              <button
                key={quickReason}
                onClick={() => setReason(quickReason)}
                className={`text-xs px-2 py-1 rounded ${
                  reason === quickReason
                    ? 'bg-yellow-500 text-white'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                {quickReason}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason or select from above..."
            className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />

          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={handleCancelDismiss}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDismiss}
              disabled={!reason.trim()}
              className="px-3 py-1 bg-yellow-500 text-white rounded text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
