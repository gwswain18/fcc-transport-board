import { query } from '../config/database.js';
import { getIO } from '../socket/index.js';
import {
  getCycleTimeSampleSize,
  getCycleTimeThresholdPercentage,
  getAlertSettings,
  getCycleTimeAlertMode,
  getPhaseThreshold,
} from './configService.js';
import { Floor, CycleTimeAlert } from '../types/index.js';
import logger from '../utils/logger.js';

const CHECK_INTERVAL_MS = 15000; // 15 seconds

let intervalId: NodeJS.Timeout | null = null;

// Track acknowledged delay phases per request: Map<requestId, Set<phase>>
const delayAcknowledgedPhases = new Map<number, Set<string>>();

export const acknowledgeDelay = (requestId: number, phase: string): void => {
  if (!delayAcknowledgedPhases.has(requestId)) {
    delayAcknowledgedPhases.set(requestId, new Set());
  }
  delayAcknowledgedPhases.get(requestId)!.add(phase);
};

export const isPhaseAcknowledged = (requestId: number, phase: string): boolean => {
  return delayAcknowledgedPhases.get(requestId)?.has(phase) ?? false;
};

export const clearDelayAcknowledgment = (requestId: number): void => {
  delayAcknowledgedPhases.delete(requestId);
};

// Phase definitions for cycle time tracking
const PHASES = [
  { name: 'response', startField: 'created_at', endField: 'assigned_at' },
  { name: 'acceptance', startField: 'assigned_at', endField: 'accepted_at' },
  { name: 'pickup', startField: 'accepted_at', endField: 'en_route_at' },
  { name: 'en_route', startField: 'en_route_at', endField: 'with_patient_at' },
  { name: 'transport', startField: 'with_patient_at', endField: 'completed_at' },
];

export const startCycleTimeService = () => {
  logger.info('Starting cycle time service...');

  if (intervalId) {
    clearInterval(intervalId);
  }

  // Initial calculation
  calculateRollingAverages().catch(logger.error);

  intervalId = setInterval(async () => {
    try {
      await checkCycleTimeAlerts();
    } catch (error) {
      logger.error('Cycle time service error:', error);
    }
  }, CHECK_INTERVAL_MS);

  // Recalculate averages every 5 minutes
  setInterval(async () => {
    try {
      await calculateRollingAverages();
    } catch (error) {
      logger.error('Rolling average calculation error:', error);
    }
  }, 300000);
};

export const stopCycleTimeService = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

export const calculateRollingAverages = async (): Promise<void> => {
  const sampleSize = await getCycleTimeSampleSize();

  // Calculate overall averages for each phase
  for (const phase of PHASES) {
    const result = await query(
      `WITH recent_requests AS (
         SELECT ${phase.startField}, ${phase.endField}
         FROM transport_requests
         WHERE ${phase.endField} IS NOT NULL
         AND ${phase.startField} IS NOT NULL
         ORDER BY ${phase.endField} DESC
         LIMIT $1
       )
       SELECT
         AVG(EXTRACT(EPOCH FROM (${phase.endField} - ${phase.startField}))) as avg_seconds,
         COUNT(*) as sample_count
       FROM recent_requests`,
      [sampleSize]
    );

    if (result.rows[0]?.avg_seconds) {
      await query(
        `INSERT INTO cycle_time_averages (phase, floor, avg_seconds, sample_count, calculated_at)
         VALUES ($1, NULL, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (phase, floor) DO UPDATE SET
           avg_seconds = $2,
           sample_count = $3,
           calculated_at = CURRENT_TIMESTAMP`,
        [phase.name, result.rows[0].avg_seconds, result.rows[0].sample_count]
      );
    }
  }

  // Calculate per-floor averages
  const floors: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
  for (const floor of floors) {
    for (const phase of PHASES) {
      const result = await query(
        `WITH recent_requests AS (
           SELECT ${phase.startField}, ${phase.endField}
           FROM transport_requests
           WHERE ${phase.endField} IS NOT NULL
           AND ${phase.startField} IS NOT NULL
           AND origin_floor = $2
           ORDER BY ${phase.endField} DESC
           LIMIT $1
         )
         SELECT
           AVG(EXTRACT(EPOCH FROM (${phase.endField} - ${phase.startField}))) as avg_seconds,
           COUNT(*) as sample_count
         FROM recent_requests`,
        [sampleSize, floor]
      );

      if (result.rows[0]?.avg_seconds) {
        await query(
          `INSERT INTO cycle_time_averages (phase, floor, avg_seconds, sample_count, calculated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (phase, floor) DO UPDATE SET
             avg_seconds = $3,
             sample_count = $4,
             calculated_at = CURRENT_TIMESTAMP`,
          [phase.name, floor, result.rows[0].avg_seconds, result.rows[0].sample_count]
        );
      }
    }
  }

  logger.info('Cycle time rolling averages updated');
};

const checkCycleTimeAlerts = async () => {
  const io = getIO();
  if (!io) return;

  // Check alert settings first
  const alertSettings = await getAlertSettings();
  if (!alertSettings.master_enabled || !alertSettings.alerts.cycle_time_alert) {
    return;
  }

  const alertMode = await getCycleTimeAlertMode();
  const thresholdPercentage = await getCycleTimeThresholdPercentage();

  // Get all in-progress requests with their current phase timing
  const activeRequests = await query(
    `SELECT
       id, status, origin_floor, assigned_to,
       created_at, assigned_at, accepted_at, en_route_at, with_patient_at
     FROM transport_requests
     WHERE status NOT IN ('complete', 'cancelled', 'pending')
     AND assigned_to IS NOT NULL`
  );

  // Clean up acknowledgments for completed requests
  const activeRequestIds = new Set(activeRequests.rows.map((r: { id: number }) => r.id));
  for (const requestId of delayAcknowledgedPhases.keys()) {
    if (!activeRequestIds.has(requestId)) {
      delayAcknowledgedPhases.delete(requestId);
    }
  }

  for (const request of activeRequests.rows) {
    const currentPhase = getPhaseForStatus(request.status);
    if (!currentPhase) continue;

    // Skip alerts for acknowledged phases
    if (isPhaseAcknowledged(request.id, currentPhase)) continue;

    const phaseConfig = PHASES.find((p) => p.name === currentPhase);
    if (!phaseConfig) continue;

    const startTime = request[phaseConfig.startField as keyof typeof request];
    if (!startTime) continue;

    const currentSeconds = (Date.now() - new Date(startTime as string).getTime()) / 1000;

    if (alertMode === 'manual_threshold') {
      // Manual threshold mode: use configured per-phase thresholds
      const phaseThreshold = await getPhaseThreshold(currentPhase);
      if (!phaseThreshold || !phaseThreshold.enabled) continue;

      const thresholdSeconds = phaseThreshold.minutes * 60;
      if (currentSeconds > thresholdSeconds) {
        const alert: CycleTimeAlert = {
          request_id: request.id,
          phase: currentPhase,
          current_seconds: Math.round(currentSeconds),
          avg_seconds: thresholdSeconds,
          threshold_percentage: 0,
          transporter_id: request.assigned_to,
        };
        io.emit('cycle_time_alert', alert);
      }
    } else {
      // Rolling average mode: use average + threshold percentage
      const avgResult = await query(
        `SELECT avg_seconds FROM cycle_time_averages
         WHERE phase = $1 AND (floor = $2 OR floor IS NULL)
         ORDER BY floor NULLS LAST
         LIMIT 1`,
        [currentPhase, request.origin_floor]
      );

      if (!avgResult.rows[0]) continue;

      const avgSeconds = parseFloat(avgResult.rows[0].avg_seconds);
      const threshold = avgSeconds * (1 + thresholdPercentage / 100);

      if (currentSeconds > threshold) {
        const alert: CycleTimeAlert = {
          request_id: request.id,
          phase: currentPhase,
          current_seconds: Math.round(currentSeconds),
          avg_seconds: Math.round(avgSeconds),
          threshold_percentage: thresholdPercentage,
          transporter_id: request.assigned_to,
        };
        io.emit('cycle_time_alert', alert);
      }
    }
  }
};

const getPhaseForStatus = (status: string): string | null => {
  switch (status) {
    case 'assigned':
      return 'acceptance';
    case 'accepted':
      return 'pickup';
    case 'en_route':
      return 'en_route';
    case 'with_patient':
      return 'transport';
    default:
      return null;
  }
};

export const getCycleTimeAverages = async (floor?: Floor) => {
  if (floor) {
    const result = await query(
      `SELECT * FROM cycle_time_averages
       WHERE floor = $1 OR floor IS NULL
       ORDER BY phase, floor NULLS LAST`,
      [floor]
    );
    return result.rows;
  }

  const result = await query(
    'SELECT * FROM cycle_time_averages ORDER BY phase, floor NULLS LAST'
  );
  return result.rows;
};

export const getPhaseAverage = async (
  phase: string,
  floor?: Floor
): Promise<number | null> => {
  const result = await query(
    `SELECT avg_seconds FROM cycle_time_averages
     WHERE phase = $1 AND (floor = $2 OR floor IS NULL)
     ORDER BY floor NULLS LAST
     LIMIT 1`,
    [phase, floor || null]
  );
  return result.rows[0]?.avg_seconds || null;
};
