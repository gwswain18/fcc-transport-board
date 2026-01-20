import { useState } from 'react';
import Modal from '../common/Modal';

interface DispatcherLoginModalProps {
  isOpen: boolean;
  hasPrimaryDispatcher: boolean;
  primaryDispatcherName?: string;
  onBecomePrimary: (contactInfo?: string) => void;
  onJoinAsSecondary: (contactInfo?: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function DispatcherLoginModal({
  isOpen,
  hasPrimaryDispatcher,
  primaryDispatcherName,
  onBecomePrimary,
  onJoinAsSecondary,
  onClose,
  loading = false,
}: DispatcherLoginModalProps) {
  const [contactInfo, setContactInfo] = useState('');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dispatcher Setup">
      <div className="space-y-6">
        {hasPrimaryDispatcher ? (
          <>
            <div className="text-center">
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
                <p className="text-primary-700 font-medium">
                  Current Primary Dispatcher
                </p>
                <p className="text-primary text-lg mt-1">
                  {primaryDispatcherName}
                </p>
              </div>
              <p className="text-gray-600">
                Would you like to take over as primary or join as a secondary dispatcher?
              </p>
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

            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={() => onBecomePrimary(contactInfo || undefined)}
                disabled={loading}
                className="w-full btn-primary py-3"
              >
                {loading ? 'Setting up...' : 'Take Over as Primary'}
              </button>
              <button
                onClick={() => onJoinAsSecondary(contactInfo || undefined)}
                disabled={loading}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Setting up...' : 'Join as Secondary'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full text-gray-600 hover:text-gray-800 py-2 text-sm"
              >
                Skip for now
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 font-medium">
                  No Primary Dispatcher
                </p>
                <p className="text-yellow-600 text-sm mt-1">
                  There is currently no primary dispatcher assigned
                </p>
              </div>
              <p className="text-gray-600">
                Would you like to become the primary dispatcher for this shift?
              </p>
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

            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={() => onBecomePrimary(contactInfo || undefined)}
                disabled={loading}
                className="w-full btn-primary py-3"
              >
                {loading ? 'Setting up...' : 'Become Primary Dispatcher'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full text-gray-600 hover:text-gray-800 py-2 text-sm"
              >
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
