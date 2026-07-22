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
const CACHE_TTL_MS = 300000; // 5 minute cache

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
  // Prefer the manager-editable minutes key (045); fall back to the legacy ms key
  const minutes = await getConfig<string | number>('auto_reassign_timeout_minutes');
  if (minutes !== null && minutes !== undefined) {
    const parsed = typeof minutes === 'number' ? minutes : parseFloat(minutes);
    if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed * 60000);
  }
  const value = await getConfig<string>('auto_assign_acceptance_timeout_ms');
  return value ? parseInt(value, 10) : 120000;
};

// Auto-reassign settings: when enabled, ANY assigned job (auto, manual, or
// claim) not accepted within the timeout is reassigned to the next available
// transporter. Disabled = no automatic reassignment at all.
export const getAutoReassignSettings = async (): Promise<{ enabled: boolean; timeoutMinutes: number }> => {
  const enabledValue = await getConfig<boolean>('auto_reassign_enabled');
  const enabled = enabledValue === null || enabledValue === undefined ? true : enabledValue !== false;
  const timeoutMinutes = (await getAutoAssignTimeoutMs()) / 60000;
  return { enabled, timeoutMinutes };
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

// Whether the free-text notes fields (request notes + delay notes) are
// enabled. Defaults to true when unset so existing deployments keep notes; a
// manager can set 'notes_enabled' to false to remove the only PHI-entry vector
// besides room number / time / destination.
export const getNotesEnabled = async (): Promise<boolean> => {
  const value = await getConfig<boolean>('notes_enabled');
  return value === null || value === undefined ? true : value !== false;
};

// Third-party sign-in provider toggles. Managers can disable Google /
// Microsoft sign-in from Settings (e.g. hidden during the pilot). Google
// defaults on (pre-toggle behavior); Microsoft defaults off. Must be enforced
// in oauthLogin/linkOAuthAccount — hiding the buttons alone is not a cutoff.
export const getAuthProviderFlags = async (): Promise<{ google: boolean; microsoft: boolean }> => {
  const google = await getConfig<boolean>('google_auth_enabled');
  const microsoft = await getConfig<boolean>('microsoft_auth_enabled');
  return {
    google: google === null || google === undefined ? true : google !== false,
    microsoft: microsoft === null || microsoft === undefined ? false : microsoft !== false,
  };
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
