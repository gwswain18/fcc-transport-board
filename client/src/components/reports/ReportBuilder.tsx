import { useState, useRef, useCallback } from 'react';
import { TransporterStats, Floor } from '../../types';
import {
  ReportType,
  ReportConfig,
  ReportData,
  MetricSelection,
  ChartSelection,
} from '../../types/reports';
import { useReportData } from '../../hooks/useReportData';
import { generatePdf } from '../../utils/pdfGenerator';
import { formatDate } from '../../utils/formatters';
import ReportPreview from './ReportPreview';

const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];

const ALL_METRICS: { key: keyof MetricSelection; label: string }[] = [
  { key: 'totalCompleted', label: 'Total Completed' },
  { key: 'totalCancelled', label: 'Total Cancelled' },
  { key: 'totalPCT', label: 'Total PCT' },
  { key: 'avgResponse', label: 'Avg Response' },
  { key: 'avgPickup', label: 'Avg Pickup' },
  { key: 'avgTransport', label: 'Avg Transport' },
  { key: 'avgCycle', label: 'Avg Cycle' },
  { key: 'timeoutRate', label: 'Timeout Rate' },
  { key: 'totalJobTime', label: 'Total Job Time' },
  { key: 'totalBreakTime', label: 'Total Break Time' },
  { key: 'avgBreakTime', label: 'Avg Break Time' },
  { key: 'totalOtherTime', label: 'Total Other Time' },
  { key: 'offlineTime', label: 'Offline Time' },
  { key: 'avgOfflineTime', label: 'Avg Offline Time' },
  { key: 'downTime', label: 'Down Time' },
];

const ALL_CHARTS: { key: keyof ChartSelection; label: string }[] = [
  { key: 'jobsByHour', label: 'Jobs by Hour' },
  { key: 'jobsByDay', label: 'Jobs by Day' },
  { key: 'delayReasons', label: 'Delay Reasons' },
  { key: 'floorAnalysis', label: 'Floor Analysis' },
  { key: 'transporterTable', label: 'Transporter Performance Table' },
];

function allTrue(obj: MetricSelection | ChartSelection): boolean {
  return Object.values(obj).every(Boolean);
}

function setAllMetrics(val: boolean): MetricSelection {
  return {
    totalCompleted: val, totalCancelled: val, totalPCT: val,
    avgResponse: val, avgPickup: val, avgTransport: val, avgCycle: val, timeoutRate: val,
    totalJobTime: val, totalBreakTime: val, avgBreakTime: val,
    totalOtherTime: val, offlineTime: val, avgOfflineTime: val, downTime: val,
  };
}

function setAllCharts(val: boolean): ChartSelection {
  return {
    jobsByHour: val, jobsByDay: val, delayReasons: val, floorAnalysis: val, transporterTable: val,
  };
}

interface ReportBuilderProps {
  dateRange: { start_date: string; end_date: string };
  transporterStats: TransporterStats[];
}

export default function ReportBuilder({ dateRange, transporterStats }: ReportBuilderProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const { fetchReportData, loading: dataLoading, progress: dataProgress } = useReportData();

  const [reportType, setReportType] = useState<ReportType>('global');
  const [startDate, setStartDate] = useState(dateRange.start_date);
  const [endDate, setEndDate] = useState(dateRange.end_date);
  const [selectedFloors, setSelectedFloors] = useState<Floor[]>([...FLOORS]);
  const [transporterId, setTransporterId] = useState('');

  const [metrics, setMetrics] = useState<MetricSelection>({
    totalCompleted: true,
    totalCancelled: true,
    totalPCT: true,
    avgResponse: true,
    avgPickup: true,
    avgTransport: true,
    avgCycle: true,
    timeoutRate: true,
    totalJobTime: true,
    totalBreakTime: true,
    avgBreakTime: true,
    totalOtherTime: true,
    offlineTime: true,
    avgOfflineTime: true,
    downTime: true,
  });

  const [charts, setCharts] = useState<ChartSelection>({
    jobsByHour: true,
    jobsByDay: true,
    delayReasons: true,
    floorAnalysis: true,
    transporterTable: true,
  });

  const [generating, setGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');

  const toggleFloor = (floor: Floor) => {
    setSelectedFloors((prev) =>
      prev.includes(floor) ? prev.filter((f) => f !== floor) : [...prev, floor]
    );
  };

  const toggleMetric = (key: keyof MetricSelection) => {
    setMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleChart = (key: keyof ChartSelection) => {
    setCharts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildConfig = useCallback((): ReportConfig => {
    const selectedTransporter = transporterStats.find(
      (t) => t.user_id === parseInt(transporterId)
    );
    return {
      reportType,
      startDate,
      endDate,
      floors: selectedFloors,
      transporterId: reportType === 'individual' && transporterId ? parseInt(transporterId) : undefined,
      transporterName: selectedTransporter
        ? `${selectedTransporter.first_name} ${selectedTransporter.last_name}`
        : undefined,
      metrics,
      charts,
    };
  }, [reportType, startDate, endDate, selectedFloors, transporterId, metrics, charts, transporterStats]);

  const handleGenerate = async () => {
    setError('');
    const config = buildConfig();

    if (reportType === 'individual' && !config.transporterId) {
      setError('Please select a transporter for an individual report.');
      return;
    }

    if (!Object.values(metrics).some(Boolean) && !Object.values(charts).some(Boolean)) {
      setError('Please select at least one metric or chart to include.');
      return;
    }

    setGenerating(true);
    setPdfProgress('Fetching report data...');

    try {
      const data = await fetchReportData(config);
      if (!data) {
        setError('Failed to fetch report data.');
        setGenerating(false);
        return;
      }

      setReportData(data);

      // Wait for React to render the preview
      setPdfProgress('Rendering charts...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!previewRef.current) {
        setError('Preview container not ready. Please try again.');
        setGenerating(false);
        return;
      }

      const dateRangeStr = `${formatDate(config.startDate + 'T00:00:00')} - ${formatDate(config.endDate + 'T00:00:00')}`;

      await generatePdf(previewRef.current, {
        title: reportType === 'individual'
          ? `Transporter Report: ${config.transporterName}`
          : 'FCC Transport Report',
        dateRange: dateRangeStr,
        reportType: config.reportType,
        transporterName: config.transporterName,
      }, setPdfProgress);

      setPdfProgress('PDF generated successfully!');
      setTimeout(() => {
        setGenerating(false);
        setPdfProgress('');
      }, 1500);
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('An error occurred while generating the PDF.');
      setGenerating(false);
    }
  };

  const allMetricsSelected = allTrue(metrics);
  const allChartsSelected = allTrue(charts);

  return (
    <div className="space-y-6">
      {/* Report Type */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Type</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="reportType"
              value="global"
              checked={reportType === 'global'}
              onChange={() => setReportType('global')}
              className="text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-gray-700">Global (All Transporters)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="reportType"
              value="individual"
              checked={reportType === 'individual'}
              onChange={() => setReportType('individual')}
              className="text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-gray-700">Individual Transporter</span>
          </label>
        </div>
      </div>

      {/* Date Range & Filters */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          {reportType === 'individual' && (
            <div>
              <label className="label">Transporter</label>
              <select
                value={transporterId}
                onChange={(e) => setTransporterId(e.target.value)}
                className="input"
              >
                <option value="">Select Transporter</option>
                {transporterStats.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.first_name} {t.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="mt-4">
          <label className="label">Floors</label>
          <div className="flex gap-3">
            {FLOORS.map((floor) => (
              <label key={floor} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFloors.includes(floor)}
                  onChange={() => toggleFloor(floor)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">{floor}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Selection */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Metrics</h3>
          <button
            type="button"
            onClick={() => setMetrics(setAllMetrics(!allMetricsSelected))}
            className="text-sm text-primary hover:text-primary-600 font-medium"
          >
            {allMetricsSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ALL_METRICS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={metrics[key]}
                onChange={() => toggleMetric(key)}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Charts Selection */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Charts</h3>
          <button
            type="button"
            onClick={() => setCharts(setAllCharts(!allChartsSelected))}
            className="text-sm text-primary hover:text-primary-600 font-medium"
          >
            {allChartsSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ALL_CHARTS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={charts[key]}
                onChange={() => toggleChart(key)}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={generating || dataLoading}
          className="btn-primary flex items-center gap-2"
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Generating...
            </>
          ) : (
            'Generate PDF Report'
          )}
        </button>
        {(generating || dataLoading) && (
          <span className="text-sm text-gray-500">
            {pdfProgress || dataProgress}
          </span>
        )}
      </div>

      {/* Hidden Preview for PDF capture */}
      {reportData && (
        <ReportPreview
          ref={previewRef}
          config={buildConfig()}
          data={reportData}
        />
      )}
    </div>
  );
}
