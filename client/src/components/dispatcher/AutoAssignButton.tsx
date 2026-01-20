import { useState } from 'react';
import { api } from '../../utils/api';

interface AutoAssignButtonProps {
  requestId: number;
  onAssigned?: (assigneeId: number, reason: string) => void;
  disabled?: boolean;
}

export default function AutoAssignButton({
  requestId,
  onAssigned,
  disabled = false,
}: AutoAssignButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAutoAssign = async () => {
    setLoading(true);
    setError('');

    const response = await api.autoAssignRequest(requestId);
    setLoading(false);

    if (response.error) {
      setError(response.error);
      setTimeout(() => setError(''), 3000);
    } else if (response.data) {
      onAssigned?.(response.data.assigned_to, response.data.reason);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleAutoAssign}
        disabled={disabled || loading}
        className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
        title="Automatically assign to best available transporter"
      >
        <svg
          className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {loading ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          )}
        </svg>
        <span>{loading ? 'Assigning...' : 'Auto'}</span>
      </button>
      {error && (
        <div className="absolute top-full left-0 mt-1 bg-red-100 text-red-700 text-xs p-2 rounded whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}
