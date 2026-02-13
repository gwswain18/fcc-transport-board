import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { subscribe, getQueueLength, flushQueue } from '../utils/offlineQueue';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueLength = useSyncExternalStore(subscribe, getQueueLength);

  const syncNow = useCallback(() => {
    flushQueue();
  }, []);

  return { isOnline, queueLength, syncNow };
}
