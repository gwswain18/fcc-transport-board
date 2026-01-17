import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Floor, ReportSummary, TransporterStats } from '../types';
import Header from '../components/common/Header';
import { formatMinutes } from '../utils/formatters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ManagerDashboard() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [transporterStats, setTransporterStats] = useState<TransporterStats[]>([]);
  const [jobsByHour, setJobsByHour] = useState<{ hour: number; count: number }[]>([]);
  const [jobsByFloor, setJobsByFloor] = useState<{ floor: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    floor: '',
    transporter_id: '',
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);

    const params = {
      start_date: filters.start_date ? `${filters.start_date}T00:00:00Z` : undefined,
      end_date: filters.end_date ? `${filters.end_date}T23:59:59Z` : undefined,
      floor: filters.floor || undefined,
      transporter_id: filters.transporter_id ? parseInt(filters.transporter_id) : undefined,
    };

    const [summaryRes, statsRes, hourRes, floorRes] = await Promise.all([
      api.getReportSummary(params),
      api.getReportByTransporter(params),
      api.getJobsByHour(params),
      api.getJobsByFloor(params),
    ]);

    if (summaryRes.data?.summary) {
      setSummary(summaryRes.data.summary);
    }
    if (statsRes.data?.transporters) {
      setTransporterStats(statsRes.data.transporters);
    }
    if (hourRes.data?.data) {
      setJobsByHour(hourRes.data.data);
    }
    if (floorRes.data?.data) {
      setJobsByFloor(floorRes.data.data);
    }

    setLoading(false);
  };

  const handleExport = () => {
    api.exportData({
      start_date: filters.start_date ? `${filters.start_date}T00:00:00Z` : undefined,
      end_date: filters.end_date ? `${filters.end_date}T23:59:59Z` : undefined,
      floor: filters.floor || undefined,
      transporter_id: filters.transporter_id ? parseInt(filters.transporter_id) : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-7xl mx-auto p-4">
        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, start_date: e.target.value }))
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, end_date: e.target.value }))
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Floor</label>
              <select
                value={filters.floor}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, floor: e.target.value }))
                }
                className="input"
              >
                <option value="">All Floors</option>
                {FLOORS.map((floor) => (
                  <option key={floor} value={floor}>
                    {floor}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Transporter</label>
              <select
                value={filters.transporter_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, transporter_id: e.target.value }))
                }
                className="input"
              >
                <option value="">All Transporters</option>
                {transporterStats.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.first_name} {t.last_name}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleExport} className="btn-primary">
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Metrics Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <MetricCard
                  title="Total Completed"
                  value={summary.total_completed.toString()}
                  color="bg-green-500"
                />
                <MetricCard
                  title="Avg Response"
                  value={formatMinutes(summary.avg_response_time_minutes)}
                  color="bg-blue-500"
                />
                <MetricCard
                  title="Avg Pickup"
                  value={formatMinutes(summary.avg_pickup_time_minutes)}
                  color="bg-purple-500"
                />
                <MetricCard
                  title="Avg Transport"
                  value={formatMinutes(summary.avg_transport_time_minutes)}
                  color="bg-orange-500"
                />
                <MetricCard
                  title="Avg Cycle"
                  value={formatMinutes(summary.avg_cycle_time_minutes)}
                  color="bg-indigo-500"
                />
                <MetricCard
                  title="Timeout Rate"
                  value={`${summary.timeout_rate.toFixed(1)}%`}
                  color="bg-red-500"
                />
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Jobs by Hour */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs by Hour</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={jobsByHour}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(h) => `${h}:00`}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(h) => `${h}:00 - ${h}:59`}
                      />
                      <Bar dataKey="count" fill="#3B82F6" name="Jobs" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Jobs by Floor */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs by Floor</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={jobsByFloor}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="floor"
                      >
                        {jobsByFloor.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Transporter Leaderboard */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Transporter Performance
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        Name
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Jobs Completed
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Avg Pickup
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Avg Transport
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transporterStats.map((t) => (
                      <tr
                        key={t.user_id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {t.first_name} {t.last_name}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {t.jobs_completed}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {formatMinutes(t.avg_pickup_time_minutes)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {formatMinutes(t.avg_transport_time_minutes)}
                        </td>
                      </tr>
                    ))}
                    {transporterStats.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-gray-500"
                        >
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className="card">
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${color.replace('bg-', 'text-')}`}>
        {value}
      </p>
    </div>
  );
}
