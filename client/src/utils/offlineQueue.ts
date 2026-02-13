import { api } from './api';

const STORAGE_KEY = 'fcc_offline_queue';

interface OfflineAction {
  action_type: string;
  payload: unknown;
  created_offline_at: string;
}

type Listener = () => void;

const listeners: Set<Listener> = new Set();
let isSyncing = false;

function getQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: OfflineAction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  notifyListeners();
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function enqueue(action: Omit<OfflineAction, 'created_offline_at'>): void {
  const queue = getQueue();
  queue.push({
    ...action,
    created_offline_at: new Date().toISOString(),
  });
  saveQueue(queue);
}

export function getQueueLength(): number {
  return getQueue().length;
}

export async function flushQueue(): Promise<void> {
  if (isSyncing) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notifyListeners();

  try {
    const result = await api.syncOfflineActions(queue);
    if (result.data) {
      // Clear queue on successful sync
      saveQueue([]);
    }
    // If result.error is a network error, keep the queue intact
  } catch {
    // Keep queue intact on network failure
  } finally {
    isSyncing = false;
    notifyListeners();
  }
}

export function getIsSyncing(): boolean {
  return isSyncing;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
