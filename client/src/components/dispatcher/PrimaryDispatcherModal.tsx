import { useState } from 'react';
import Modal from '../common/Modal';

interface PrimaryDispatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (isPrimary: boolean, contactInfo?: string) => void;
  loading?: boolean;
}

export default function PrimaryDispatcherModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: PrimaryDispatcherModalProps) {
  const [isPrimary, setIsPrimary] = useState(false);
  const [contactInfo, setContactInfo] = useState('');

  const handleConfirm = () => {
    onConfirm(isPrimary, contactInfo || undefined);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dispatcher Setup">
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-gray-700 mb-4">
            Are you the primary dispatcher for this shift?
          </p>

          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => setIsPrimary(true)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isPrimary
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Yes, I'm Primary
            </button>
            <button
              onClick={() => setIsPrimary(false)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                !isPrimary
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              No, I'm Assisting
            </button>
          </div>
        </div>

        <div>
          <label className="label">Contact Info (optional)</label>
          <input
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="input"
            placeholder="e.g., Ext 1234 or mobile number"
          />
          <p className="text-xs text-gray-500 mt-1">
            This will be displayed to other staff for emergencies
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 btn-primary py-3"
          >
            {loading ? 'Setting up...' : 'Continue'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
