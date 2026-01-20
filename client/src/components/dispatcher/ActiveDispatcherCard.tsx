import { useState } from 'react';
import { ActiveDispatcher } from '../../types';

interface ActiveDispatcherCardProps {
  dispatchers: ActiveDispatcher[];
  currentUserId?: number;
  onTakeBreak?: () => void;
  onReturnFromBreak?: (asPrimary?: boolean) => void;
  onSetPrimary?: () => void;
}

export default function ActiveDispatcherCard({
  dispatchers,
  currentUserId,
  onTakeBreak,
  onReturnFromBreak,
  onSetPrimary,
}: ActiveDispatcherCardProps) {
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);

  const primary = dispatchers.find((d) => d.is_primary);
  const assistants = dispatchers.filter((d) => !d.is_primary);
  const currentUserDispatcher = dispatchers.find((d) => d.user_id === currentUserId);
  const isCurrentUserActive = !!currentUserDispatcher;
  const isCurrentUserPrimary = currentUserDispatcher?.is_primary || false;
  const isCurrentUserOnBreak = currentUserDispatcher?.on_break || false;

  const handleReturnClick = () => {
    setShowReturnPrompt(true);
  };

  const handleReturnConfirm = (asPrimary: boolean) => {
    setShowReturnPrompt(false);
    onReturnFromBreak?.(asPrimary);
  };

  // Empty state handling
  if (dispatchers.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-700 mb-3">No dispatcher currently active</p>
        {currentUserId && onSetPrimary && (
          <button onClick={onSetPrimary} className="w-full btn-primary text-sm py-2">
            Set Myself as Primary
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Main header - matches Transporters style */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Dispatchers</h2>

      {/* Primary Section */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Primary</h3>
        {primary ? (
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-900">
              {primary.user?.first_name} {primary.user?.last_name}
            </span>
            {primary.on_break && (
              <span className="text-sm text-gray-500 ml-1">(Unavailable)</span>
            )}
            {primary.user_id === currentUserId && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">You</span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">None</p>
        )}
      </div>

      {/* Assistants Section */}
      <div className="border-t border-gray-100 pt-3">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Assistants</h3>
        {assistants.length > 0 ? (
          <div className="space-y-1">
            {assistants.map((assistant) => (
              <div key={assistant.id} className="flex items-center">
                <span className="text-sm text-gray-700">
                  {assistant.user?.first_name} {assistant.user?.last_name}
                </span>
                {assistant.on_break && (
                  <span className="text-sm text-gray-500 ml-1">(Unavailable)</span>
                )}
                {assistant.user_id === currentUserId && (
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">You</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">None</p>
        )}
      </div>

      {/* Action Button - Toggle based on break status */}
      {currentUserId && isCurrentUserActive && (
        <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
          {isCurrentUserOnBreak ? (
            <button
              onClick={handleReturnClick}
              className="w-full bg-green-100 text-green-700 hover:bg-green-200 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
            >
              Return from Break
            </button>
          ) : (
            <>
              <button
                onClick={onTakeBreak}
                className="w-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
              >
                Take a Break
              </button>
              {!isCurrentUserPrimary && onSetPrimary && (
                <button
                  onClick={onSetPrimary}
                  className="w-full bg-primary-50 text-primary hover:bg-primary-100 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                >
                  Become Primary
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Return from Break Confirmation Prompt */}
      {showReturnPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Return from Break</h3>
            <p className="text-sm text-gray-600 mb-4">Would you like to return as Primary Dispatcher?</p>
            <div className="space-y-2">
              <button
                onClick={() => handleReturnConfirm(true)}
                className="w-full bg-primary text-white hover:bg-primary-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
              >
                Yes, as Primary
              </button>
              <button
                onClick={() => handleReturnConfirm(false)}
                className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
              >
                No, as Assistant
              </button>
              <button
                onClick={() => setShowReturnPrompt(false)}
                className="w-full text-gray-500 hover:text-gray-700 py-2 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
