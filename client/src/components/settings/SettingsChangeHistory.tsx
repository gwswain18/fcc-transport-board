import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { api } from '../../utils/api';
import { SettingsAuditLog } from '../../types';

const PAGE_SIZE = 20;
const MAX_VISIBLE_DIFFS = 6;

const KEY_LABELS: Record<string, string> = {
  alert_settings: 'Alert Settings',
  notes_enabled: 'Free-text Notes',
  auto_reassign_enabled: 'Auto-Reassign',
  auto_reassign_timeout_minutes: 'Auto-Reassign Timeout',
  cycle_time_alert_mode: 'Cycle Time Alert Mode',
  auto_assign_acceptance_timeout_ms: 'Auto-Reassign Timeout (legacy)',
};

const PHASE_NAMES: Record<string, string> = {
  response: 'Response',
  acceptance: 'Acceptance',
  pickup: 'Pickup',
  en_route: 'En Route',
  transport: 'Transport',
};

function keyLabel(key: string | undefined): string {
  if (!key) return 'Unknown setting';
  if (key.startsWith('phase_threshold_')) {
    const phase = key.replace('phase_threshold_', '');
    return `Cycle Threshold: ${PHASE_NAMES[phase] || phase}`;
  }
  return KEY_LABELS[key] || key;
}

// Values may arrive double-encoded (thresholds are stored as JSON strings)
function normalize(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      trimmed === 'true' ||
      trimmed === 'false' ||
      /^-?\d+(\.\d+)?$/.test(trimmed)
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
  }
  return value;
}

function formatLeaf(value: unknown): string {
  if (value === null || value === undefined) return '(not set)';
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface DiffRow {
  path: string;
  from: unknown;
  to: unknown;
}

// Flatten both values and return only the leaf paths that changed
function diffValues(oldVal: unknown, newVal: unknown, path = ''): DiffRow[] {
  const a = normalize(oldVal);
  const b = normalize(newVal);

  const aIsObj = a !== null && typeof a === 'object' && !Array.isArray(a);
  const bIsObj = b !== null && typeof b === 'object' && !Array.isArray(b);

  if (aIsObj || bIsObj) {
    const keys = new Set([
      ...Object.keys((a as Record<string, unknown>) || {}),
      ...Object.keys((b as Record<string, unknown>) || {}),
    ]);
    const rows: DiffRow[] = [];
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      rows.push(
        ...diffValues(
          aIsObj ? (a as Record<string, unknown>)[key] : undefined,
          bIsObj ? (b as Record<string, unknown>)[key] : undefined,
          childPath
        )
      );
    }
    return rows;
  }

  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  return [{ path: path || 'value', from: a, to: b }];
}

function LogEntry({ log }: { log: SettingsAuditLog }) {
  const [expanded, setExpanded] = useState(false);

  const key = log.new_values?.key ?? log.old_values?.key;
  const userName =
    log.first_name || log.last_name
      ? `${log.first_name ?? ''} ${log.last_name ?? ''}`.trim()
      : 'System';

  const diffs =
    log.action === 'delete'
      ? [{ path: 'value', from: normalize(log.old_values?.value), to: undefined }]
      : diffValues(log.old_values?.value, log.new_values?.value);

  const visible = expanded ? diffs : diffs.slice(0, MAX_VISIBLE_DIFFS);
  const hidden = diffs.length - visible.length;

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-gray-700">
          {keyLabel(key)}
          {log.action === 'delete' && (
            <span className="ml-2 text-xs text-red-600 font-normal">deleted</span>
          )}
        </p>
        <p className="text-xs text-gray-400">
          {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
      <p className="text-xs text-gray-500 mb-1">by {userName}</p>
      {diffs.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No changes (re-saved)</p>
      ) : (
        <div className="space-y-0.5">
          {visible.map((diff) => (
            <p key={diff.path} className="text-xs text-gray-600">
              {diff.path !== 'value' && (
                <span className="text-gray-400">{diff.path}: </span>
              )}
              <span className="line-through text-gray-400">{formatLeaf(diff.from)}</span>
              {' → '}
              <span className="font-medium text-gray-700">{formatLeaf(diff.to)}</span>
            </p>
          ))}
          {hidden > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-primary hover:underline"
            >
              +{hidden} more changes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Manager-only card showing who changed which setting, when, old -> new
export default function SettingsChangeHistory() {
  const [logs, setLogs] = useState<SettingsAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (offset: number) => {
    const response = await api.getConfigAuditHistory(PAGE_SIZE, offset);
    if (response.error) {
      setError('Failed to load settings history');
      return;
    }
    const page = response.data?.logs ?? [];
    setLogs((prev) => (offset === 0 ? page : [...prev, ...page]));
    setHasMore(page.length === PAGE_SIZE);
  }, []);

  useEffect(() => {
    (async () => {
      await loadPage(0);
      setLoading(false);
    })();
  }, [loadPage]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadPage(logs.length);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Settings Change History</h3>

      {error && <div className="mb-4 p-3 rounded bg-red-100 text-red-700">{error}</div>}

      {logs.length === 0 && !error ? (
        <p className="text-sm text-gray-400 italic">No settings changes recorded yet.</p>
      ) : (
        <div>
          {logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
