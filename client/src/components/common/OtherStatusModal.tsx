import { useState } from 'react';

interface OtherStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (explanation: string) => void;
}

export default function OtherStatusModal({
  isOpen,
  onClose,
  onConfirm,
}: OtherStatusModalProps) {
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation.trim()) {
      setError('Please provide an explanation for the "Other" status');
      return;
    }
    onConfirm(explanation.trim());
    setExplanation('');
    setError('');
  };

  const handleClose = () => {
    setExplanation('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={handleClose}
        />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Other Status Explanation
          </h3>
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a brief explanation for why you are setting your
              status to "Other".
            </p>
            <textarea
              value={explanation}
              onChange={(e) => {
                setExplanation(e.target.value);
                setError('');
              }}
              placeholder="e.g., Equipment maintenance, Training session, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
              autoFocus
            />
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
            <div className="flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
