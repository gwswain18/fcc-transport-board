import { query } from '../config/database.js';

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
  require_explanation_on_dismiss: boolean;
}

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
  require_explanation_on_dismiss: true,
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
  };
};
