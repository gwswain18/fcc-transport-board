import { useState, useCallback } from 'react';
import { api } from '../utils/api';
import { ReportConfig, ReportData } from '../types/reports';

export function useReportData() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const fetchReportData = useCallback(async (config: ReportConfig): Promise<ReportData | null> => {
    setLoading(true);

    const params = {
      start_date: `${config.startDate}T00:00:00Z`,
      end_date: `${config.endDate}T23:59:59Z`,
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

      // Global summary (always for global, or as comparison for individual)
      if (needsSummary) {
        setProgress('Fetching summary data...');
        promises.push(
          api.getReportSummary(params).then((res) => {
            if (res.data?.summary) result.summary = res.data.summary;
          })
        );
      }

      // Individual summary (for comparison)
      if (needsSummary && config.reportType === 'individual' && config.transporterId) {
        promises.push(
          api.getReportSummary({ ...params, transporter_id: config.transporterId }).then((res) => {
            if (res.data?.summary) result.individualSummary = res.data.summary;
          })
        );
      }

      // Time metrics (global)
      if (needsTimeMetrics) {
        setProgress('Fetching time metrics...');
        promises.push(
          api.getTimeMetrics(params).then((res) => {
            if (res.data) result.timeMetrics = res.data;
          })
        );
      }

      // Individual time metrics
      if (needsTimeMetrics && config.reportType === 'individual' && config.transporterId) {
        promises.push(
          api.getTimeMetrics({ ...params, transporter_id: config.transporterId }).then((res) => {
            if (res.data) result.individualTimeMetrics = res.data;
          })
        );
      }

      // Transporter stats
      if (needsTransporterStats) {
        setProgress('Fetching transporter data...');
        promises.push(
          api.getReportByTransporter(params).then((res) => {
            if (res.data?.transporters) result.transporterStats = res.data.transporters;
          })
        );
      }

      // Jobs by hour
      if (needsJobsByHour) {
        setProgress('Fetching hourly data...');
        promises.push(
          api.getJobsByHour(params).then((res) => {
            if (res.data?.data) {
              // Fill all hours 9-21
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
        setProgress('Fetching daily data...');
        promises.push(
          api.getJobsByDay(params).then((res) => {
            if (res.data?.jobsByDay) result.jobsByDay = res.data.jobsByDay;
          })
        );
      }

      // Floor analysis
      if (needsFloorAnalysis) {
        setProgress('Fetching floor analysis...');
        promises.push(
          api.getFloorAnalysis(params).then((res) => {
            if (res.data?.floors) result.floorAnalysis = res.data.floors;
          })
        );
      }

      // Delay data
      if (needsDelayData) {
        setProgress('Fetching delay data...');
        promises.push(
          api.getDelayReport(params).then((res) => {
            if (res.data) result.delayData = res.data;
          })
        );
      }

      await Promise.all(promises);

      setProgress('Data loaded successfully');
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
