import { ReportSummary, TransporterStats } from './index';

export type ReportType = 'global' | 'individual';

export interface ReportConfig {
  reportType: ReportType;
  startDate: string;
  endDate: string;
  floors: string[];
  transporterId?: number;
  transporterName?: string;
  metrics: MetricSelection;
  charts: ChartSelection;
}

export interface MetricSelection {
  totalCompleted: boolean;
  totalCancelled: boolean;
  totalPCT: boolean;
  avgResponse: boolean;
  avgPickup: boolean;
  avgTransport: boolean;
  avgCycle: boolean;
  timeoutRate: boolean;
  totalJobTime: boolean;
  totalBreakTime: boolean;
  avgBreakTime: boolean;
  totalOtherTime: boolean;
  offlineTime: boolean;
  avgOfflineTime: boolean;
  downTime: boolean;
}

export interface ChartSelection {
  jobsByHour: boolean;
  jobsByDay: boolean;
  delayReasons: boolean;
  floorAnalysis: boolean;
  transporterTable: boolean;
}

export interface TimeMetrics {
  transporters: Array<{
    user_id: number;
    first_name: string;
    last_name: string;
    job_time_seconds: number;
    break_time_seconds: number;
    other_time_seconds: number;
    offline_time_seconds: number;
    down_time_seconds: number;
  }>;
  totals: {
    total_job_time_seconds: number;
    total_break_time_seconds: number;
    total_other_time_seconds: number;
    total_offline_time_seconds: number;
    total_down_time_seconds: number;
  };
}

export interface FloorAnalysisData {
  floor: string;
  total_requests: number;
  avg_response_time: number;
  avg_pickup_time: number;
  avg_transport_time: number;
  avg_cycle_time: number;
  pct_transferred: number;
  cancelled_count: number;
}

export interface DelayData {
  byReason: Array<{ reason: string; count: number }>;
  byTransporter: Array<{
    user_id: number;
    first_name: string;
    last_name: string;
    total_delays: number;
    reasons: Array<{ reason: string; count: number }>;
  }>;
}

export interface ReportData {
  summary: ReportSummary | null;
  individualSummary: ReportSummary | null;
  transporterStats: TransporterStats[];
  timeMetrics: TimeMetrics | null;
  individualTimeMetrics: TimeMetrics | null;
  jobsByHour: Array<{ hour: number; count: number }>;
  jobsByDay: Array<{ date: string; count: number }>;
  floorAnalysis: FloorAnalysisData[];
  delayData: DelayData | null;
}
