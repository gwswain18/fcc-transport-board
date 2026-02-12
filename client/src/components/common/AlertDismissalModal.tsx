import { useState } from 'react';
import Modal from './Modal';

const REASONS_BY_TYPE: Record<string, Array<{ value: string; label: string }>> = {
  break: [
    { value: 'forgot_to_click_available', label: 'Forgot to Click Available' },
    { value: 'other', label: 'Other' },
  ],
  offline: [
    { value: 'screen_lock', label: 'Screen Lock' },
    { value: 'other', label: 'Other' },
  ],
  timeout: [
    { value: 'patient_not_ready', label: 'Patient not ready' },
    { value: 'staffing_issue', label: 'Staffing issue' },
    { value: 'equipment_delay', label: 'Equipment delay' },
    { value: 'high_volume', label: 'High volume' },
    { value: 'other', label: 'Other' },
  ],
  cycle: [
    { value: 'patient_not_ready', label: 'Patient not ready' },
    { value: 'staffing_issue', label: 'Staffing issue' },
    { value: 'equipment_delay', label: 'Equipment delay' },
    { value: 'high_volume', label: 'High volume' },
    { value: 'other', label: 'Other' },
  ],
};

interface AlertDismissalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (explanation: string) => void;
  alertType?: 'timeout' | 'break' | 'offline' | 'cycle';
  alertDetails?: string;
}

export default function AlertDismissalModal({
  isOpen,
  onClose,
  onConfirm,
  alertType = 'timeout',
  alertDetails,
}: AlertDismissalModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    const explanation = selectedReason === 'other' ? customReason : selectedReason;
    if (explanation) {
      onConfirm(explanation);
      setSelectedReason('');
      setCustomReason('');
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    onClose();
  };

  const getTitle = () => {
    switch (alertType) {
      case 'break':
        return 'Dismiss Break Alert';
      case 'offline':
        return 'Dismiss Offline Alert';
      case 'cycle':
        return 'Dismiss Cycle Time Alert';
      default:
        return 'Dismiss Timeout Alert';
    }
  };

  const isValid = selectedReason && (selectedReason !== 'other' || customReason.trim());

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={getTitle()}>
      <div className="space-y-4">
        {alertDetails && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700">{alertDetails}</p>
          </div>
        )}

        <div>
          <label className="label">Reason for dismissal</label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="input"
          >
            <option value="">Select a reason...</option>
            {(REASONS_BY_TYPE[alertType] || REASONS_BY_TYPE.timeout).map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>

        {selectedReason === 'other' && (
          <div>
            <label className="label">Please specify</label>
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Enter your reason..."
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="btn-primary disabled:opacity-50"
          >
            Dismiss Alert
          </button>
        </div>
      </div>
    </Modal>
  );
}
