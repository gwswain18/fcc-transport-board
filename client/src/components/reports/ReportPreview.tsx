import { forwardRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ReportConfig, ReportData } from '../../types/reports';
import { formatMinutes, formatSecondsAsHoursMinutes } from '../../utils/formatters';

interface ReportPreviewProps {
  config: ReportConfig;
  data: ReportData;
}

const ReportPreview = forwardRef<HTMLDivElement, ReportPreviewProps>(
  ({ config, data }, ref) => {
    const { metrics, charts, reportType } = config;
    const isIndividual = reportType === 'individual';

    // For individual: compute comparison rows
    const comparisonRows = isIndividual ? buildComparisonRows(config, data) : null;

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '794px',
          backgroundColor: '#ffffff',
          color: '#1f2937',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Metrics Section */}
        {Object.values(metrics).some(Boolean) && (
          <div data-pdf-section="Metrics" style={{ padding: '16px' }}>
            {isIndividual && comparisonRows ? (
              <ComparisonTable rows={comparisonRows} />
            ) : (
              <MetricsGrid config={config} data={data} />
            )}
          </div>
        )}

        {/* Jobs by Hour Chart */}
        {charts.jobsByHour && data.jobsByHour.length > 0 && (
          <div data-pdf-section="Jobs by Hour" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              Jobs by Hour
            </h3>
            <BarChart width={750} height={300} data={data.jobsByHour}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => {
                  const hour = Number(h);
                  if (hour === 0) return '12 AM';
                  if (hour < 12) return `${hour} AM`;
                  if (hour === 12) return '12 PM';
                  return `${hour - 12} PM`;
                }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(h) => {
                  const hour = Number(h);
                  if (hour === 0) return '12:00 AM';
                  if (hour < 12) return `${hour}:00 AM`;
                  if (hour === 12) return '12:00 PM';
                  return `${hour - 12}:00 PM`;
                }}
              />
              <Bar dataKey="count" fill="#002952" name="Jobs" />
            </BarChart>
          </div>
        )}

        {/* Jobs by Day Chart */}
        {charts.jobsByDay && data.jobsByDay.length > 0 && (
          <div data-pdf-section="Jobs by Day" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              Jobs by Day
            </h3>
            <BarChart width={750} height={300} data={data.jobsByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#002952" name="Jobs" />
            </BarChart>
          </div>
        )}

        {/* Delay Reasons Chart */}
        {charts.delayReasons && data.delayData && data.delayData.byReason.length > 0 && (
          <div data-pdf-section="Delay Reasons" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              Delay Reasons
            </h3>
            <BarChart
              width={750}
              height={Math.max(200, data.delayData.byReason.length * 40)}
              data={data.delayData.byReason}
              layout="vertical"
              margin={{ left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="reason" type="category" width={180} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#002952" name="Occurrences" />
            </BarChart>
          </div>
        )}

        {/* Floor Analysis Charts */}
        {charts.floorAnalysis && data.floorAnalysis.length > 0 && (
          <>
            <div data-pdf-section="Floor Volume" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                Request Volume by Floor
              </h3>
              <BarChart
                width={750}
                height={300}
                data={data.floorAnalysis.map((d) => {
                  const pctCount = Math.round(d.total_requests * d.pct_transferred / 100);
                  return {
                    floor: d.floor,
                    Completed: d.total_requests - d.cancelled_count - pctCount,
                    PCT: pctCount,
                    Cancelled: d.cancelled_count,
                  };
                })}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="floor" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Completed" stackId="a" fill="#002952" name="Completed" />
                <Bar dataKey="PCT" stackId="a" fill="#a36d00" name="PCT Transfers" />
                <Bar dataKey="Cancelled" stackId="a" fill="#EF4444" name="Cancelled" />
              </BarChart>
            </div>

            <div data-pdf-section="Floor Times" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                Average Times by Floor (minutes)
              </h3>
              <BarChart
                width={750}
                height={300}
                data={data.floorAnalysis.map((d) => ({
                  floor: d.floor,
                  Response: d.avg_response_time,
                  Pickup: d.avg_pickup_time,
                  Transport: d.avg_transport_time,
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="floor" type="category" />
                <Tooltip formatter={(value: number) => formatMinutes(value)} />
                <Legend />
                <Bar dataKey="Response" fill="#002952" name="Response Time" />
                <Bar dataKey="Pickup" fill="#8598c1" name="Pickup Time" />
                <Bar dataKey="Transport" fill="#a36d00" name="Transport Time" />
              </BarChart>
            </div>
          </>
        )}

        {/* Transporter Performance Table */}
        {charts.transporterTable && data.transporterStats.length > 0 && (
          <div data-pdf-section="Transporter Performance" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              Transporter Performance
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#4b5563' }}>Name</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Jobs</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Avg Pickup</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Avg Transport</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Job Time</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Break</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Other</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Offline</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#4b5563' }}>Down</th>
                </tr>
              </thead>
              <tbody>
                {data.transporterStats.map((t) => {
                  const tm = data.timeMetrics?.transporters.find((tm) => tm.user_id === t.user_id);
                  return (
                    <tr key={t.user_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px', fontWeight: 500, color: '#1f2937' }}>
                        {t.first_name} {t.last_name}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4b5563' }}>
                        {t.jobs_completed}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4b5563' }}>
                        {formatMinutes(t.avg_pickup_time_minutes)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4b5563' }}>
                        {formatMinutes(t.avg_transport_time_minutes)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4b5563' }}>
                        {tm ? formatSecondsAsHoursMinutes(tm.job_time_seconds) : '-'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4b5563' }}>
                        {tm ? formatSecondsAsHoursMinutes(tm.break_time_seconds) : '-'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4b5563' }}>
                        {tm ? formatSecondsAsHoursMinutes(tm.other_time_seconds) : '-'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4b5563' }}>
                        {tm ? formatSecondsAsHoursMinutes(tm.offline_time_seconds) : '-'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4b5563' }}>
                        {tm ? formatSecondsAsHoursMinutes(tm.down_time_seconds) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
);

ReportPreview.displayName = 'ReportPreview';
export default ReportPreview;

// --- Helper components ---

interface ComparisonRow {
  label: string;
  transporterValue: string;
  globalValue: string;
  diff: string;
  diffColor: string;
}

function buildComparisonRows(config: ReportConfig, data: ReportData): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const ind = data.individualSummary;
  const glob = data.summary;
  const { metrics } = config;

  if (!ind || !glob) return rows;

  const indTm = data.individualTimeMetrics;
  const globTm = data.timeMetrics;

  const addRow = (label: string, indVal: number, globVal: number, formatter: (n: number) => string, lowerIsBetter = true) => {
    const diff = indVal - globVal;
    const isGood = lowerIsBetter ? diff <= 0 : diff >= 0;
    rows.push({
      label,
      transporterValue: formatter(indVal),
      globalValue: formatter(globVal),
      diff: `${diff >= 0 ? '+' : ''}${formatter(Math.abs(diff))}`,
      diffColor: Math.abs(diff) < 0.01 ? '#6b7280' : isGood ? '#059669' : '#dc2626',
    });
  };

  const fmtMin = formatMinutes;
  const fmtNum = (n: number) => Math.round(n).toString();
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtSec = formatSecondsAsHoursMinutes;

  if (metrics.totalCompleted) addRow('Total Completed', ind.total_completed, glob.total_completed, fmtNum, false);
  if (metrics.totalCancelled) addRow('Total Cancelled', ind.total_cancelled, glob.total_cancelled, fmtNum, true);
  if (metrics.totalPCT) addRow('Total PCT', ind.total_pct, glob.total_pct, fmtNum, true);
  if (metrics.avgResponse) addRow('Avg Response', ind.avg_response_time_minutes, glob.avg_response_time_minutes, fmtMin, true);
  if (metrics.avgPickup) addRow('Avg Pickup', ind.avg_pickup_time_minutes, glob.avg_pickup_time_minutes, fmtMin, true);
  if (metrics.avgTransport) addRow('Avg Transport', ind.avg_transport_time_minutes, glob.avg_transport_time_minutes, fmtMin, true);
  if (metrics.avgCycle) addRow('Avg Cycle', ind.avg_cycle_time_minutes, glob.avg_cycle_time_minutes, fmtMin, true);
  if (metrics.timeoutRate) addRow('Timeout Rate', ind.timeout_rate, glob.timeout_rate, fmtPct, true);

  // Time metrics comparisons
  if (indTm && globTm) {
    const indCount = indTm.transporters.length || 1;
    const globCount = globTm.transporters.length || 1;
    const indTotals = indTm.totals;
    const globTotals = globTm.totals;

    if (metrics.totalJobTime) addRow('Total Job Time', indTotals.total_job_time_seconds, globTotals.total_job_time_seconds / globCount, fmtSec, false);
    if (metrics.totalBreakTime) addRow('Total Break Time', indTotals.total_break_time_seconds, globTotals.total_break_time_seconds / globCount, fmtSec, true);
    if (metrics.avgBreakTime) addRow('Avg Break Time', indTotals.total_break_time_seconds / indCount, globTotals.total_break_time_seconds / globCount, fmtSec, true);
    if (metrics.totalOtherTime) addRow('Total Other Time', indTotals.total_other_time_seconds, globTotals.total_other_time_seconds / globCount, fmtSec, true);
    if (metrics.offlineTime) addRow('Offline Time', indTotals.total_offline_time_seconds, globTotals.total_offline_time_seconds / globCount, fmtSec, true);
    if (metrics.avgOfflineTime) addRow('Avg Offline Time', indTotals.total_offline_time_seconds / indCount, globTotals.total_offline_time_seconds / globCount, fmtSec, true);
    if (metrics.downTime) addRow('Down Time', indTotals.total_down_time_seconds, globTotals.total_down_time_seconds / globCount, fmtSec, true);
  }

  return rows;
}

function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
          <th style={{ textAlign: 'left', padding: '10px 12px', color: '#4b5563', fontWeight: 600 }}>Metric</th>
          <th style={{ textAlign: 'right', padding: '10px 12px', color: '#4b5563', fontWeight: 600 }}>Transporter</th>
          <th style={{ textAlign: 'right', padding: '10px 12px', color: '#4b5563', fontWeight: 600 }}>All Avg</th>
          <th style={{ textAlign: 'right', padding: '10px 12px', color: '#4b5563', fontWeight: 600 }}>Diff</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1f2937' }}>{row.label}</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1f2937' }}>{row.transporterValue}</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{row.globalValue}</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: row.diffColor }}>{row.diff}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MetricsGrid({ config, data }: { config: ReportConfig; data: ReportData }) {
  const { metrics } = config;
  const summary = data.summary;
  const tm = data.timeMetrics;

  if (!summary) return null;

  const items: { label: string; value: string; color: string }[] = [];

  if (metrics.totalCompleted) items.push({ label: 'Total Completed', value: summary.total_completed.toString(), color: '#059669' });
  if (metrics.totalCancelled) items.push({ label: 'Total Cancelled', value: summary.total_cancelled.toString(), color: '#dc2626' });
  if (metrics.totalPCT) items.push({ label: 'Total PCT', value: summary.total_pct.toString(), color: '#7c3aed' });
  if (metrics.avgResponse) items.push({ label: 'Avg Response', value: formatMinutes(summary.avg_response_time_minutes), color: '#8598c1' });
  if (metrics.avgPickup) items.push({ label: 'Avg Pickup', value: formatMinutes(summary.avg_pickup_time_minutes), color: '#7c3aed' });
  if (metrics.avgTransport) items.push({ label: 'Avg Transport', value: formatMinutes(summary.avg_transport_time_minutes), color: '#ea580c' });
  if (metrics.avgCycle) items.push({ label: 'Avg Cycle', value: formatMinutes(summary.avg_cycle_time_minutes), color: '#4f46e5' });
  if (metrics.timeoutRate) items.push({ label: 'Timeout Rate', value: `${summary.timeout_rate.toFixed(1)}%`, color: '#dc2626' });

  if (tm) {
    const count = tm.transporters.length || 1;
    if (metrics.totalJobTime) items.push({ label: 'Total Job Time', value: formatSecondsAsHoursMinutes(tm.totals.total_job_time_seconds), color: '#0891b2' });
    if (metrics.totalBreakTime) items.push({ label: 'Total Break Time', value: formatSecondsAsHoursMinutes(tm.totals.total_break_time_seconds), color: '#ca8a04' });
    if (metrics.avgBreakTime) items.push({ label: 'Avg Break Time', value: formatSecondsAsHoursMinutes(tm.totals.total_break_time_seconds / count), color: '#d97706' });
    if (metrics.totalOtherTime) items.push({ label: 'Total Other Time', value: formatSecondsAsHoursMinutes(tm.totals.total_other_time_seconds), color: '#ea580c' });
    if (metrics.offlineTime) items.push({ label: 'Offline Time', value: formatSecondsAsHoursMinutes(tm.totals.total_offline_time_seconds), color: '#6b7280' });
    if (metrics.avgOfflineTime) items.push({ label: 'Avg Offline Time', value: formatSecondsAsHoursMinutes(tm.totals.total_offline_time_seconds / count), color: '#9ca3af' });
    if (metrics.downTime) items.push({ label: 'Down Time', value: formatSecondsAsHoursMinutes(tm.totals.total_down_time_seconds), color: '#0d9488' });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{item.label}</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: item.color }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
