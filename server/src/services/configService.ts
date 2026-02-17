import { query } from '../config/database.js';

// Alert timing configuration (minutes)
export interface AlertTiming {
  pending_timeout_minutes: number;
  stat_timeout_minutes: number;
  acceptance_timeout_minutes: number;
  break_alert_minutes: number;
  offline_alert_minutes: number;
}

// Alert Settings Interface
export interface AlertSettings {
  master_enabled: boolean;
  alerts: {
    pending_timeout: boolean;
    stat_timeout: boolean;
    acceptance_timeout: boolean;
    break_alert: boolean;
    offline_alert: boolean;
    cycle_time_alert: boolean;
  };
  timing?: AlertTiming;
  require_explanation_on_dismiss: boolean;
  require_transporter_explanation_on_dismiss: boolean;
  auto_logout_enabled?: boolean;
  auto_logout_time?: string; // HH:MM format
}

const DEFAULT_ALERT_TIMING: AlertTiming = {
  pending_timeout_minutes: 5,
  stat_timeout_minutes: 2,
  acceptance_timeout_minutes: 5,
  break_alert_minutes: 30,
  offline_alert_minutes: 2,
};

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  master_enabled: true,
  alerts: {
    pending_timeout: true,
    stat_timeout: true,
    acceptance_timeout: true,
    break_alert: true,
    offline_alert: true,
    cycle_time_alert: true,
  },
  timing: DEFAULT_ALERT_TIMING,
  require_explanation_on_dismiss: true,
  require_transporter_explanation_on_dismiss: true,
};

// In-memory cache for frequently accessed config
const configCache: Map<string, { value: unknown; cachedAt: number }> = new Map();
const CACHE_TTL_MS = 60000; // 1 minute cache

export const getConfig = async <T = unknown>(key: string): Promise<T | null> => {
  // Check cache first
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value as T;
  }

  const result = await query(
    'SELECT value FROM system_config WHERE key = $1',
    [key]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const value = result.rows[0].value;
  configCache.set(key, { value, cachedAt: Date.now() });
  return value as T;
};

export const setConfig = async (key: string, value: unknown): Promise<void> => {
  await query(
    `INSERT INTO system_config (key, value, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
    [key, JSON.stringify(value)]
  );

  // Update cache
  configCache.set(key, { value, cachedAt: Date.now() });
};

export const getAllConfig = async (): Promise<Record<string, unknown>> => {
  const result = await query('SELECT key, value FROM system_config');
  const config: Record<string, unknown> = {};
  for (const row of result.rows) {
    config[row.key] = row.value;
  }
  return config;
};

export const deleteConfig = async (key: string): Promise<boolean> => {
  const result = await query(
    'DELETE FROM system_config WHERE key = $1',
    [key]
  );
  configCache.delete(key);
  return (result.rowCount ?? 0) > 0;
};

// Helper functions for specific config values
export const getCycleTimeSampleSize = async (): Promise<number> => {
  const value = await getConfig<string>('cycle_time_sample_size');
  return value ? parseInt(value, 10) : 50;
};

export const getCycleTimeThresholdPercentage = async (): Promise<number> => {
  const value = await getConfig<string>('cycle_time_threshold_percentage');
  return value ? parseInt(value, 10) : 30;
};

export const getHeartbeatTimeoutMs = async (): Promise<number> => {
  const value = await getConfig<string>('heartbeat_timeout_ms');
  return value ? parseInt(value, 10) : 120000;
};

export const getAutoAssignTimeoutMs = async (): Promise<number> => {
  const value = await getConfig<string>('auto_assign_acceptance_timeout_ms');
  return value ? parseInt(value, 10) : 120000;
};

export const getBreakAlertMinutes = async (): Promise<number> => {
  const value = await getConfig<string>('break_alert_minutes');
  return value ? parseInt(value, 10) : 30;
};

export const getCycleTimeAlertMode = async (): Promise<'rolling_average' | 'manual_threshold'> => {
  const value = await getConfig<string>('cycle_time_alert_mode');
  if (value === 'rolling_average') return 'rolling_average';
  return 'manual_threshold';
};

export const getPhaseThreshold = async (phase: string): Promise<{ minutes: number; enabled: boolean } | null> => {
  const value = await getConfig<string>(`phase_threshold_${phase}`);
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

// Clear cache (useful for testing or forced refresh)
export const clearConfigCache = (): void => {
  configCache.clear();
};

export const getAlertSettings = async (): Promise<AlertSettings> => {
  const value = await getConfig<AlertSettings>('alert_settings');
  if (!value) {
    return DEFAULT_ALERT_SETTINGS;
  }
  // Merge with defaults to ensure all fields exist
  return {
    ...DEFAULT_ALERT_SETTINGS,
    ...value,
    alerts: {
      ...DEFAULT_ALERT_SETTINGS.alerts,
      ...(value.alerts || {}),
    },
    timing: {
      ...DEFAULT_ALERT_TIMING,
      ...(value.timing || {}),
    },
  };
};

export const getAlertTiming = async (): Promise<AlertTiming> => {
  const settings = await getAlertSettings();
  return settings.timing || DEFAULT_ALERT_TIMING;
};
