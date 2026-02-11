import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Floor } from '../../types';

interface ActivityEntry {
  id: number;
  action: string;
  timestamp: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  actor: { first_name: string; last_name: string } | null;
  request: {
    id: number;
    origin_floor: string;
    room_number: string;
    destination: string;
    priority: string;
    status: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
const STATUSES = ['pending', 'assigned', 'accepted', 'en_route', 'with_patient', 'complete', 'cancelled'];

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  status_change: 'Status Changed',
  update: 'Updated',
  assign: 'Assigned',
  cancel: 'Cancelled',
};

export default function JobActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    floor: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    loadData(1);
  }, [filters]);

  const loadData = async (page: number) => {
    setLoading(true);
    const response = await api.getActivityLog({
      start_date: filters.start_date ? `${filters.start_date}T00:00:00Z` : undefined,
      end_date: filters.end_date ? `${filters.end_date}T23:59:59Z` : undefined,
      floor: filters.floor || undefined,
      status: filters.status || undefined,
      search: filters.search || undefined,
      page,
      limit: 50,
    });

    if (response.data) {
      setEntries(response.data.entries);
      setPagination(response.data.pagination);
    }
    setLoading(false);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionDescription = (entry: ActivityEntry): string => {
    if (entry.action === 'status_change' && entry.old_values && entry.new_values) {
      const from = (entry.old_values as Record<string, string>).status || '?';
      const to = (entry.new_values as Record<string, string>).status || '?';
      return `${from} → ${to}`;
    }
    if (entry.action === 'create') {
      return 'Request created';
    }
    return ACTION_LABELS[entry.action] || entry.action;
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
            <label className="label">Floor</label>
            <select
              value={filters.floor}
              onChange={(e) => setFilters((prev) => ({ ...prev, floor: e.target.value }))}
              className="input"
            >
              <option value="">All Floors</option>
              {FLOORS.map((floor) => (
                <option key={floor} value={floor}>{floor}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="input"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Room, name..."
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Activity Log
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
        ) : entries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No activity found</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Time</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Action</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Job</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Actor</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatTime(entry.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-gray-900">
                          {ACTION_LABELS[entry.action] || entry.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {entry.request ? (
                          <span className="font-medium text-gray-900">
                            {entry.request.origin_floor}-{entry.request.room_number}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {entry.actor
                          ? `${entry.actor.first_name} ${entry.actor.last_name}`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {getActionDescription(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
