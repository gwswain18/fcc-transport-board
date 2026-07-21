import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DelayByReason {
  reason: string;
  count: number;
}

interface DelayByTransporter {
  user_id: number;
  first_name: string;
  last_name: string;
  total_delays: number;
  reasons: { reason: string; count: number }[];
}

interface Reassignment {
  id: number;
  request_id: number;
  timestamp: string;
  type: 'timed_out' | 'manual';
  origin_floor: string;
  room_number: string;
  destination: string;
  from: { first_name: string; last_name: string } | null;
  to: { first_name: string; last_name: string } | null;
  actor: { first_name: string; last_name: string } | null;
  acknowledged_at: string | null;
}

interface DelayReportProps {
  dateRange?: {
    start_date: string;
    end_date: string;
  };
}

export default function DelayReport({ dateRange }: DelayReportProps) {
  const [byReason, setByReason] = useState<DelayByReason[]>([]);
  const [byTransporter, setByTransporter] = useState<DelayByTransporter[]>([]);
  const [reassignments, setReassignments] = useState<Reassignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDelayReport();
  }, [dateRange]);

  const loadDelayReport = async () => {
    setLoading(true);
    const [delayRes, reassignRes] = await Promise.all([
      api.getDelayReport(dateRange),
      api.getReassignments(dateRange),
    ]);
    if (delayRes.data) {
      setByReason(delayRes.data.byReason);
      setByTransporter(delayRes.data.byTransporter);
    }
    if (reassignRes.data) {
      setReassignments(reassignRes.data.reassignments);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delay Report</h3>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (byReason.length === 0 && byTransporter.length === 0 && reassignments.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delay Report</h3>
        <p className="text-gray-500 text-center py-8">No delay data available for the selected date range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delay Reasons Bar Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delay Reasons</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byReason} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                dataKey="reason"
                type="category"
                width={180}
                tick={{ fontSize: 13 }}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#002952" name="Occurrences" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Delays by Transporter Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delays by Transporter</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Total Delays</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Most Common Reason</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {byTransporter.map((t) => {
                const topReason = t.reasons.reduce(
                  (max, r) => (r.count > max.count ? r : max),
                  t.reasons[0]
                );
                return (
                  <tr
                    key={t.user_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {t.first_name} {t.last_name}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {t.total_delays}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {topReason?.reason || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-sm">
                      {t.reasons.map((r) => `${r.reason} (${r.count})`).join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassignments Table */}
      {reassignments.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reassignments</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">When</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Job</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">From</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">To</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Acknowledged</th>
                </tr>
              </thead>
              <tbody>
                {reassignments.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {r.origin_floor} Room {r.room_number} → {r.destination}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {r.from ? `${r.from.first_name} ${r.from.last_name}` : 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {r.to ? (
                        `${r.to.first_name} ${r.to.last_name}`
                      ) : (
                        <span className="text-gray-400 italic">Returned to pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.type === 'timed_out' ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                          Timed out
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                          Manual
                          {r.actor ? ` · ${r.actor.first_name} ${r.actor.last_name}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {r.type === 'timed_out' ? (r.acknowledged_at ? 'Yes' : 'No') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
