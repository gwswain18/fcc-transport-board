import { useState, useCallback } from 'react';
import { api } from '../utils/api';
import { ReportConfig, ReportData } from '../types/reports';

export function useReportData() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const fetchReportData = useCallback(async (config: ReportConfig): Promise<ReportData | null> => {
    setLoading(true);

    // Pass floor filter when a single floor is selected; omit for multi-floor (API returns all)
    const floorParam = config.floors.length === 1 ? config.floors[0] : undefined;

    const params: { start_date: string; end_date: string; floor?: string } = {
      start_date: `${config.startDate}T00:00:00Z`,
      end_date: `${config.endDate}T23:59:59Z`,
      ...(floorParam && { floor: floorParam }),
    };

    const hasAnyMetric = Object.values(config.metrics).some(Boolean);
    const hasAnyChart = Object.values(config.charts).some(Boolean);

    if (!hasAnyMetric && !hasAnyChart) {
      setLoading(false);
      return null;
    }

    const result: ReportData = {
      summary: null,
      individualSummary: null,
      transporterStats: [],
      timeMetrics: null,
      individualTimeMetrics: null,
      jobsByHour: [],
      jobsByDay: [],
      floorAnalysis: [],
      delayData: null,
    };

    try {
      // Determine which fetches are needed
      const needsSummary = hasAnyMetric;
      const needsTimeMetrics = config.metrics.totalJobTime || config.metrics.totalBreakTime ||
        config.metrics.avgBreakTime || config.metrics.totalOtherTime ||
        config.metrics.offlineTime || config.metrics.avgOfflineTime || config.metrics.downTime;
      const needsTransporterStats = config.charts.transporterTable;
      const needsJobsByHour = config.charts.jobsByHour;
      const needsJobsByDay = config.charts.jobsByDay;
      const needsFloorAnalysis = config.charts.floorAnalysis;
      const needsDelayData = config.charts.delayReasons;

      const promises: Promise<void>[] = [];
      const errors: string[] = [];

      // Helper to track API errors per section
      const tracked = <T,>(label: string, promise: Promise<{ data?: T; error?: string }>): Promise<{ data?: T; error?: string }> =>
        promise.then((res) => {
          if (res.error) errors.push(`${label}: ${res.error}`);
          return res;
        });

      // Global summary (always for global, or as comparison for individual)
      if (needsSummary) {
        promises.push(
          tracked('Summary', api.getReportSummary(params)).then((res) => {
            if (res.data?.summary) result.summary = res.data.summary;
          })
        );
      }

      // Individual summary (for comparison)
      if (needsSummary && config.reportType === 'individual' && config.transporterId) {
        promises.push(
          tracked('Individual Summary', api.getReportSummary({ ...params, transporter_id: config.transporterId })).then((res) => {
            if (res.data?.summary) result.individualSummary = res.data.summary;
          })
        );
      }

      // Time metrics (global)
      if (needsTimeMetrics) {
        promises.push(
          tracked('Time Metrics', api.getTimeMetrics(params)).then((res) => {
            if (res.data) result.timeMetrics = res.data;
          })
        );
      }

      // Individual time metrics
      if (needsTimeMetrics && config.reportType === 'individual' && config.transporterId) {
        promises.push(
          tracked('Individual Time Metrics', api.getTimeMetrics({ ...params, transporter_id: config.transporterId })).then((res) => {
            if (res.data) result.individualTimeMetrics = res.data;
          })
        );
      }

      // Transporter stats
      if (needsTransporterStats) {
        promises.push(
          tracked('Transporter Stats', api.getReportByTransporter(params)).then((res) => {
            if (res.data?.transporters) result.transporterStats = res.data.transporters;
          })
        );
      }

      // Jobs by hour
      if (needsJobsByHour) {
        promises.push(
          tracked('Jobs by Hour', api.getJobsByHour(params)).then((res) => {
            if (res.data?.data) {
              const hourMap = new Map<number, number>();
              res.data.data.forEach((item) => hourMap.set(Number(item.hour), Number(item.count)));
              const allHours: { hour: number; count: number }[] = [];
              for (let h = 9; h <= 21; h++) {
                allHours.push({ hour: h, count: hourMap.get(h) || 0 });
              }
              result.jobsByHour = allHours;
            }
          })
        );
      }

      // Jobs by day
      if (needsJobsByDay) {
        promises.push(
          tracked('Jobs by Day', api.getJobsByDay(params)).then((res) => {
            if (res.data?.jobsByDay) result.jobsByDay = res.data.jobsByDay;
          })
        );
      }

      // Floor analysis
      if (needsFloorAnalysis) {
        promises.push(
          tracked('Floor Analysis', api.getFloorAnalysis(params)).then((res) => {
            if (res.data?.floors) result.floorAnalysis = res.data.floors;
          })
        );
      }

      // Delay data
      if (needsDelayData) {
        promises.push(
          tracked('Delay Report', api.getDelayReport(params)).then((res) => {
            if (res.data) result.delayData = res.data;
          })
        );
      }

      setProgress('Fetching report data...');
      await Promise.all(promises);

      if (errors.length > 0) {
        console.warn('Some report data failed to load:', errors);
        setProgress(`Loaded with ${errors.length} warning(s)`);
      } else {
        setProgress('Data loaded successfully');
      }

      setLoading(false);
      return result;
    } catch (error) {
      console.error('Error fetching report data:', error);
      setProgress('Error fetching data');
      setLoading(false);
      return null;
    }
  }, []);

  return { fetchReportData, loading, progress };
}
