import { useOfflineStatus } from '../../hooks/useOfflineStatus';

export default function OfflineBanner() {
  const { isOnline, queueLength, syncNow } = useOfflineStatus();

  if (isOnline && queueLength === 0) return null;

  if (!isOnline) {
    return (
      <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium">
        You are offline.{' '}
        {queueLength > 0 && (
          <>{queueLength} action{queueLength !== 1 ? 's' : ''} queued. </>
        )}
        Actions will sync when reconnected.
      </div>
    );
  }

  // Online but queue not empty — syncing
  return (
    <div className="bg-yellow-500 text-white text-center py-2 px-4 text-sm font-medium">
      Syncing {queueLength} queued action{queueLength !== 1 ? 's' : ''}...{' '}
      <button onClick={syncNow} className="underline font-bold ml-1">
        Retry
      </button>
    </div>
  );
}
