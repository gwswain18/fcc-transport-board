import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { formatSecondsAsHoursMinutes } from '../../utils/formatters';

interface ShiftLogEntry {
  user_id: number;
  first_name: string;
  last_name: string;
  shift_date: string;
  earliest_start: string;
  latest_end: string | null;
  is_active: boolean;
  total_shift_seconds: number;
  break_time_seconds: number;
  other_time_seconds: number;
  shift_ids: number[];
  segment_count: number;
  timeline: Array<{
    type: 'shift_start' | 'shift_end' | 'status_change';
    timestamp: string;
    status?: string | null;
    shift_id?: number | null;
  }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  assigned: 'Assigned',
  accepted: 'Accepted',
  en_route: 'En Route',
  with_patient: 'With Patient',
  on_break: 'On Break',
  other: 'Other',
  offline: 'Offline',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  on_break: 'bg-yellow-500',
  other: 'bg-orange-500',
  assigned: 'bg-blue-500',
  accepted: 'bg-blue-600',
  en_route: 'bg-indigo-500',
  with_patient: 'bg-purple-500',
  offline: 'bg-gray-400',
};

function TimelineDot({ color }: { color: string }) {
  return <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${color}`} />;
}

function ShiftTimeline({ timeline }: { timeline: ShiftLogEntry['timeline'] }) {
  if (timeline.length === 0) {
    return <p className="text-sm text-gray-400 italic">No timeline events</p>;
  }

  return (
    <div className="space-y-0">
      {timeline.map((event, i) => {
        const isLast = i === timeline.length - 1;
        let dotColor = 'bg-gray-400';
        let label = '';

        if (event.type === 'shift_start') {
          dotColor = 'bg-green-500';
          label = 'Shift Start';
        } else if (event.type === 'shift_end') {
          dotColor = 'bg-red-500';
          label = 'Shift End';
        } else if (event.type === 'status_change' && event.status) {
          dotColor = STATUS_DOT_COLORS[event.status] || 'bg-gray-400';
          label = STATUS_LABELS[event.status] || event.status;
        }

        return (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <TimelineDot color={dotColor} />
              {!isLast && <div className="w-0.5 h-6 bg-gray-200" />}
            </div>
            <div className="flex items-center gap-2 pb-1">
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <span className="text-xs text-gray-500">{formatTime(event.timestamp)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShiftCard({ entry, expanded, onToggle }: { entry: ShiftLogEntry; expanded: boolean; onToggle: () => void }) {
  const duration = formatSecondsAsHoursMinutes(entry.total_shift_seconds);
  const breakTime = formatSecondsAsHoursMinutes(entry.break_time_seconds);
  const otherTime = formatSecondsAsHoursMinutes(entry.other_time_seconds);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        {/* Transporter name */}
        <div className="flex-shrink-0 w-36">
          <span className="text-sm font-bold text-gray-900">
            {entry.first_name} {entry.last_name}
          </span>
        </div>

        {/* Date */}
        <div className="flex-shrink-0 w-36 hidden sm:block">
          <span className="text-sm text-gray-600">{formatDate(entry.shift_date)}</span>
        </div>

        {/* Start - End */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-600">
            {formatTime(entry.earliest_start)}
            {' - '}
            {entry.is_active ? (
              <span className="text-green-600 font-medium">Active</span>
            ) : entry.latest_end ? (
              formatTime(entry.latest_end)
            ) : (
              '-'
            )}
          </span>
        </div>

        {/* Duration */}
        <div className="flex-shrink-0 text-sm text-gray-500 w-16 text-right hidden md:block">
          {duration}
        </div>

        {/* Break */}
        <div className="flex-shrink-0 text-sm text-yellow-600 w-16 text-right hidden lg:block">
          {breakTime}
        </div>

        {/* Other */}
        <div className="flex-shrink-0 text-sm text-orange-600 w-16 text-right hidden lg:block">
          {otherTime}
        </div>

        {/* Active badge */}
        {entry.is_active && (
          <span className="flex-shrink-0 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
            Active
          </span>
        )}

        {/* Expand icon */}
        <div className="flex-shrink-0 text-gray-400">
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Shift summary */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Shift Summary</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(entry.shift_date)}</span></div>
                <div><span className="text-gray-500">Start:</span> <span className="font-medium">{formatTime(entry.earliest_start)}</span></div>
                <div>
                  <span className="text-gray-500">End:</span>{' '}
                  <span className="font-medium">
                    {entry.is_active ? (
                      <span className="text-green-600">Currently Active</span>
                    ) : entry.latest_end ? (
                      formatTime(entry.latest_end)
                    ) : (
                      '-'
                    )}
                  </span>
                </div>
                <div><span className="text-gray-500">Duration:</span> <span className="font-medium">{duration}</span></div>
                <div><span className="text-gray-500">Break Time:</span> <span className="font-medium text-yellow-600">{breakTime}</span></div>
                <div><span className="text-gray-500">Other Time:</span> <span className="font-medium text-orange-600">{otherTime}</span></div>
                {entry.segment_count > 1 && (
                  <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                    Note: This shift has {entry.segment_count} segments (shift was restarted {entry.segment_count - 1} time{entry.segment_count > 2 ? 's' : ''})
                  </div>
                )}
              </div>
            </div>

            {/* Right: Timeline */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Timeline</h4>
              <ShiftTimeline timeline={entry.timeline} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShiftLogTab() {
  const [shiftLogs, setShiftLogs] = useState<ShiftLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    search: '',
  });

  useEffect(() => {
    loadData(1);
  }, [filters]);

  const loadData = async (page: number) => {
    setLoading(true);
    const response = await api.getShiftLogs({
      start_date: filters.start_date ? `${filters.start_date}T00:00:00Z` : undefined,
      end_date: filters.end_date ? `${filters.end_date}T23:59:59Z` : undefined,
      search: filters.search || undefined,
      page,
      limit: 20,
    });

    if (response.data) {
      setShiftLogs(response.data.shiftLogs);
      setPagination(response.data.pagination);
    }
    setLoading(false);
  };

  const getCardKey = (entry: ShiftLogEntry) => `${entry.user_id}-${entry.shift_date}`;

  const toggleExpand = (entry: ShiftLogEntry) => {
    const key = getCardKey(entry);
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Name..."
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="hidden md:flex items-center gap-4 px-4 text-xs font-semibold text-gray-500 uppercase">
        <div className="w-36">Transporter</div>
        <div className="w-36 hidden sm:block">Date</div>
        <div className="flex-1">Start - End</div>
        <div className="w-16 text-right hidden md:block">Duration</div>
        <div className="w-16 text-right hidden lg:block">Break</div>
        <div className="w-16 text-right hidden lg:block">Other</div>
        <div className="w-4" />
      </div>

      {/* Shift Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Shift Logs
            {pagination.total > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({pagination.total} entries)
              </span>
            )}
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : shiftLogs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No shift logs found</p>
        ) : (
          <>
            <div className="space-y-2">
              {shiftLogs.map((entry) => (
                <ShiftCard
                  key={getCardKey(entry)}
                  entry={entry}
                  expanded={expandedKey === getCardKey(entry)}
                  onToggle={() => toggleExpand(entry)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadData(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => loadData(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
