import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../utils/api';

interface DispatcherOption {
  id: number;
  first_name: string;
  last_name: string;
  dispatcher_id?: number;
  is_primary?: boolean;
  on_break?: boolean;
}

interface BreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reliefUserId?: number, reliefText?: string) => void;
  loading?: boolean;
  isPrimary: boolean;
}

export default function BreakModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  isPrimary,
}: BreakModalProps) {
  const [dispatchers, setDispatchers] = useState<DispatcherOption[]>([]);
  const [selectedDispatcher, setSelectedDispatcher] = useState<string>('');
  const [freeText, setFreeText] = useState('');
  const [loadingDispatchers, setLoadingDispatchers] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadDispatchers();
    }
  }, [isOpen]);

  const loadDispatchers = async () => {
    setLoadingDispatchers(true);
    const response = await api.getAvailableDispatchers();
    if (response.data?.dispatchers) {
      // Show all dispatcher/supervisor users as potential relief options
      setDispatchers(response.data.dispatchers);
    }
    setLoadingDispatchers(false);
  };

  const handleConfirm = () => {
    if (selectedDispatcher === 'other') {
      if (!freeText.trim()) {
        return; // Require text if "other" is selected
      }
      onConfirm(undefined, freeText.trim());
    } else if (selectedDispatcher) {
      onConfirm(parseInt(selectedDispatcher), undefined);
    } else {
      // No relief selected - require free text
      if (!freeText.trim()) {
        return;
      }
      onConfirm(undefined, freeText.trim());
    }
  };

  const availableDispatchers = dispatchers.filter((d) => !d.is_primary && !d.on_break);
  const needsRelief = isPrimary;
  const canSubmit = !needsRelief || selectedDispatcher || freeText.trim();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Take a Break">
      <div className="space-y-6">
        {isPrimary && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700">
              As the primary dispatcher, you need to designate someone to cover while you're away.
            </p>
          </div>
        )}

        {needsRelief && (
          <div>
            <label className="label">Select Relief Dispatcher</label>
            {loadingDispatchers ? (
              <p className="text-gray-500 text-sm">Loading available dispatchers...</p>
            ) : availableDispatchers.length > 0 ? (
              <select
                value={selectedDispatcher}
                onChange={(e) => setSelectedDispatcher(e.target.value)}
                className="input"
              >
                <option value="">Choose a dispatcher...</option>
                {availableDispatchers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.first_name} {d.last_name}
                  </option>
                ))}
                <option value="other">Other (specify below)</option>
              </select>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  No other dispatchers currently available. Please specify who will cover:
                </p>
              </div>
            )}
          </div>
        )}

        {(selectedDispatcher === 'other' || availableDispatchers.length === 0 || !needsRelief) && (
          <div>
            <label className="label">
              {needsRelief ? 'Who is covering? (required)' : 'Notes (optional)'}
            </label>
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className="input"
              placeholder="e.g., Charge nurse on FCC4, John from night shift"
            />
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary py-3"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !canSubmit}
            className="flex-1 btn-primary py-3"
          >
            {loading ? 'Processing...' : 'Go on Break'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
