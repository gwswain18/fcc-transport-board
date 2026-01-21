import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Floor, ReportSummary, TransporterStats } from '../types';
import Header from '../components/common/Header';
import { formatMinutes, formatSecondsAsHoursMinutes } from '../utils/formatters';
import FloorAnalysis from '../components/analytics/FloorAnalysis';
import CycleTimeThresholdSettings from '../components/settings/CycleTimeThresholdSettings';
import AlertSettings from '../components/settings/AlertSettings';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];

type TabType = 'overview' | 'floors' | 'settings';

export default function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [transporterStats, setTransporterStats] = useState<TransporterStats[]>([]);
  const [jobsByHour, setJobsByHour] = useState<{ hour: number; count: number }[]>([]);
  const [jobsByDay, setJobsByDay] = useState<{ date: string; count: number }[]>([]);
  const [timeMetrics, setTimeMetrics] = useState<{
    transporters: Array<{
      user_id: number;
      first_name: string;
      last_name: string;
      job_time_seconds: number;
      break_time_seconds: number;
      other_time_seconds: number;
      down_time_seconds: number;
    }>;
    totals: {
      total_job_time_seconds: number;
      total_break_time_seconds: number;
      total_other_time_seconds: number;
      total_down_time_seconds: number;
    };
  } | null>(null);
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

  const fillMissingEvenHours = (data: { hour: number; count: number }[]): { hour: number; count: number }[] => {
    const hourMap = new Map<number, number>();
    data.forEach(item => hourMap.set(Number(item.hour), Number(item.count)));

    const evenHours: { hour: number; count: number }[] = [];
    for (let h = 0; h <= 22; h += 2) {
      const evenCount = hourMap.get(h) || 0;
      const oddCount = hourMap.get(h + 1) || 0;
      evenHours.push({ hour: h, count: evenCount + oddCount });
    }
    return evenHours;
  };

  const loadData = async () => {
    setLoading(true);

    const params = {
      start_date: filters.start_date ? `${filters.start_date}T00:00:00Z` : undefined,
      end_date: filters.end_date ? `${filters.end_date}T23:59:59Z` : undefined,
      floor: filters.floor || undefined,
      transporter_id: filters.transporter_id ? parseInt(filters.transporter_id) : undefined,
    };

    const [summaryRes, statsRes, hourRes, dayRes, timeMetricsRes] = await Promise.all([
      api.getReportSummary(params),
      api.getReportByTransporter(params),
      api.getJobsByHour(params),
      api.getJobsByDay(7),
      api.getTimeMetrics(params),
    ]);

    if (summaryRes.data?.summary) {
      setSummary(summaryRes.data.summary);
    }
    if (statsRes.data?.transporters) {
      setTransporterStats(statsRes.data.transporters);
    }
    if (hourRes.data?.data) {
      setJobsByHour(fillMissingEvenHours(hourRes.data.data));
    }
    if (dayRes.data?.jobsByDay) {
      setJobsByDay(dayRes.data.jobsByDay);
    }
    if (timeMetricsRes.data) {
      setTimeMetrics(timeMetricsRes.data);
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
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('floors')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'floors'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Floor Analysis
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Floor Analysis Tab */}
        {activeTab === 'floors' && (
          <FloorAnalysis
            dateRange={{
              start_date: filters.start_date ? `${filters.start_date}T00:00:00Z` : '',
              end_date: filters.end_date ? `${filters.end_date}T23:59:59Z` : '',
            }}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <AlertSettings />
            <CycleTimeThresholdSettings />
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
                  color="bg-secondary"
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

            {/* Time Metrics Cards */}
            {timeMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <MetricCard
                  title="Total Time on Jobs"
                  value={formatSecondsAsHoursMinutes(timeMetrics.totals.total_job_time_seconds)}
                  color="bg-cyan-500"
                />
                <MetricCard
                  title="Total Break Time"
                  value={formatSecondsAsHoursMinutes(timeMetrics.totals.total_break_time_seconds)}
                  color="bg-yellow-500"
                />
                <MetricCard
                  title="Total Other Time"
                  value={formatSecondsAsHoursMinutes(timeMetrics.totals.total_other_time_seconds)}
                  color="bg-orange-500"
                />
                <MetricCard
                  title="Down Time"
                  value={formatSecondsAsHoursMinutes(timeMetrics.totals.total_down_time_seconds)}
                  color="bg-teal-500"
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
                        labelFormatter={(h) => `${h}:00 - ${Number(h) + 1}:59`}
                      />
                      <Bar dataKey="count" fill="#002952" name="Jobs" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Jobs by Day */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs by Day (Last 7 Days)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={jobsByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#002952" name="Jobs" />
                    </BarChart>
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
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Job Time
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Break Time
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Other Time
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Down Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transporterStats.map((t) => {
                      const tm = timeMetrics?.transporters.find(tm => tm.user_id === t.user_id);
                      return (
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
                          <td className="py-3 px-4 text-right text-gray-600">
                            {tm ? formatSecondsAsHoursMinutes(tm.job_time_seconds) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600">
                            {tm ? formatSecondsAsHoursMinutes(tm.break_time_seconds) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600">
                            {tm ? formatSecondsAsHoursMinutes(tm.other_time_seconds) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600">
                            {tm ? formatSecondsAsHoursMinutes(tm.down_time_seconds) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {transporterStats.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
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
