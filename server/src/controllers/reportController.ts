import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import logger from '../utils/logger.js';

export const getSummary = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date, shift_start, shift_end, floor, transporter_id } = req.query;

    let whereClause = "WHERE status = 'complete'";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    if (shift_start && shift_end) {
      whereClause += ` AND EXTRACT(HOUR FROM created_at) >= $${paramIndex++}`;
      params.push(parseInt(shift_start as string));
      whereClause += ` AND EXTRACT(HOUR FROM created_at) < $${paramIndex++}`;
      params.push(parseInt(shift_end as string));
    }

    if (floor) {
      whereClause += ` AND origin_floor = $${paramIndex++}`;
      params.push(floor);
    }

    if (transporter_id) {
      whereClause += ` AND assigned_to = $${paramIndex++}`;
      params.push(transporter_id);
    }

    const result = await query(
      `SELECT
        COUNT(*) as total_completed,
        AVG(EXTRACT(EPOCH FROM (accepted_at - created_at)) / 60) as avg_response_time,
        AVG(EXTRACT(EPOCH FROM (with_patient_at - created_at)) / 60) as avg_pickup_time,
        AVG(EXTRACT(EPOCH FROM (completed_at - with_patient_at)) / 60) as avg_transport_time,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_cycle_time
       FROM transport_requests
       ${whereClause}`,
      params
    );

    // Calculate timeout rate (jobs that took > 5 min to accept)
    const timeoutResult = await query(
      `SELECT
        COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (accepted_at - created_at)) > 300) as timed_out,
        COUNT(*) as total
       FROM transport_requests
       ${whereClause}`,
      params
    );

    const summary = result.rows[0];
    const timeoutData = timeoutResult.rows[0];
    const timeoutRate = timeoutData.total > 0
      ? (parseInt(timeoutData.timed_out) / parseInt(timeoutData.total)) * 100
      : 0;

    res.json({
      summary: {
        total_completed: parseInt(summary.total_completed) || 0,
        avg_response_time_minutes: parseFloat(summary.avg_response_time) || 0,
        avg_pickup_time_minutes: parseFloat(summary.avg_pickup_time) || 0,
        avg_transport_time_minutes: parseFloat(summary.avg_transport_time) || 0,
        avg_cycle_time_minutes: parseFloat(summary.avg_cycle_time) || 0,
        timeout_rate: timeoutRate,
      },
    });
  } catch (error) {
    logger.error('Get summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getByTransporter = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date, shift_start, shift_end, floor } = req.query;

    let whereClause = "WHERE tr.status = 'complete' AND tr.assigned_to IS NOT NULL";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND tr.created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND tr.created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    if (shift_start && shift_end) {
      whereClause += ` AND EXTRACT(HOUR FROM tr.created_at) >= $${paramIndex++}`;
      params.push(parseInt(shift_start as string));
      whereClause += ` AND EXTRACT(HOUR FROM tr.created_at) < $${paramIndex++}`;
      params.push(parseInt(shift_end as string));
    }

    if (floor) {
      whereClause += ` AND tr.origin_floor = $${paramIndex++}`;
      params.push(floor);
    }

    const result = await query(
      `SELECT
        tr.assigned_to as user_id,
        u.first_name,
        u.last_name,
        COUNT(*) as jobs_completed,
        AVG(EXTRACT(EPOCH FROM (tr.with_patient_at - tr.created_at)) / 60) as avg_pickup_time,
        AVG(EXTRACT(EPOCH FROM (tr.completed_at - tr.with_patient_at)) / 60) as avg_transport_time
       FROM transport_requests tr
       JOIN users u ON tr.assigned_to = u.id
       ${whereClause}
       GROUP BY tr.assigned_to, u.first_name, u.last_name
       ORDER BY jobs_completed DESC`,
      params
    );

    const transporters = result.rows.map((row) => ({
      user_id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      jobs_completed: parseInt(row.jobs_completed),
      avg_pickup_time_minutes: parseFloat(row.avg_pickup_time) || 0,
      avg_transport_time_minutes: parseFloat(row.avg_transport_time) || 0,
      idle_time_minutes: 0, // Would need more complex calculation
    }));

    res.json({ transporters });
  } catch (error) {
    logger.error('Get by transporter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJobsByHour = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date, floor, transporter_id } = req.query;

    let whereClause = "WHERE status = 'complete'";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    if (floor) {
      whereClause += ` AND origin_floor = $${paramIndex++}`;
      params.push(floor);
    }

    if (transporter_id) {
      whereClause += ` AND assigned_to = $${paramIndex++}`;
      params.push(transporter_id);
    }

    const result = await query(
      `SELECT
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
       FROM transport_requests
       ${whereClause}
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      params
    );

    res.json({ data: result.rows });
  } catch (error) {
    logger.error('Get jobs by hour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJobsByFloor = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date, floor, transporter_id } = req.query;

    let whereClause = "WHERE status = 'complete'";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    if (floor) {
      whereClause += ` AND origin_floor = $${paramIndex++}`;
      params.push(floor);
    }

    if (transporter_id) {
      whereClause += ` AND assigned_to = $${paramIndex++}`;
      params.push(transporter_id);
    }

    const result = await query(
      `SELECT
        origin_floor as floor,
        COUNT(*) as count
       FROM transport_requests
       ${whereClause}
       GROUP BY origin_floor
       ORDER BY floor`,
      params
    );

    res.json({ data: result.rows });
  } catch (error) {
    logger.error('Get jobs by floor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportData = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date, floor, transporter_id } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND tr.created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND tr.created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    if (floor) {
      whereClause += ` AND tr.origin_floor = $${paramIndex++}`;
      params.push(floor);
    }

    if (transporter_id) {
      whereClause += ` AND tr.assigned_to = $${paramIndex++}`;
      params.push(transporter_id);
    }

    const result = await query(
      `SELECT
        tr.id,
        tr.origin_floor,
        tr.room_number,
        tr.destination,
        tr.priority,
        tr.notes,
        tr.status,
        tr.created_at,
        tr.assigned_at,
        tr.accepted_at,
        tr.en_route_at,
        tr.with_patient_at,
        tr.completed_at,
        tr.cancelled_at,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        assignee.first_name || ' ' || assignee.last_name as assigned_to_name
       FROM transport_requests tr
       LEFT JOIN users creator ON tr.created_by = creator.id
       LEFT JOIN users assignee ON tr.assigned_to = assignee.id
       ${whereClause}
       ORDER BY tr.created_at DESC`,
      params
    );

    // Convert to CSV
    const headers = [
      'ID', 'Floor', 'Room', 'Destination', 'Priority',
      'Notes', 'Status', 'Created At', 'Assigned At', 'Accepted At',
      'En Route At', 'With Patient At', 'Completed At', 'Cancelled At',
      'Created By', 'Assigned To'
    ];

    const rows = result.rows.map((row) => [
      row.id,
      row.origin_floor,
      row.room_number,
      row.destination,
      row.priority,
      row.notes || '',
      row.status,
      row.created_at,
      row.assigned_at || '',
      row.accepted_at || '',
      row.en_route_at || '',
      row.with_patient_at || '',
      row.completed_at || '',
      row.cancelled_at || '',
      row.created_by_name || '',
      row.assigned_to_name || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transport_requests.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Export data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get staffing by floor (current snapshot)
export const getStaffingByFloor = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const floors = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
    const staffing = [];

    for (const floor of floors) {
      // Get all active transporters for this floor
      const result = await query(
        `SELECT
          ts.status,
          COUNT(*) as count
         FROM transporter_status ts
         JOIN users u ON ts.user_id = u.id
         WHERE u.role = 'transporter'
           AND u.is_active = true
           AND (u.primary_floor = $1 OR $1 = '')
           AND ts.status != 'offline'
         GROUP BY ts.status`,
        [floor]
      );

      let available = 0;
      let busy = 0;
      let onBreak = 0;
      let total = 0;

      for (const row of result.rows) {
        const count = parseInt(row.count);
        total += count;

        if (row.status === 'available') {
          available = count;
        } else if (row.status === 'on_break' || row.status === 'other') {
          onBreak += count;
        } else {
          busy += count;
        }
      }

      staffing.push({
        floor,
        active_transporters: total,
        available_transporters: available,
        busy_transporters: busy,
        on_break_transporters: onBreak,
      });
    }

    res.json({ staffing });
  } catch (error) {
    logger.error('Get staffing by floor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get time metrics (job time, break time, available time) per transporter
export const getTimeMetrics = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date, floor, transporter_id } = req.query;

    let whereClause = "WHERE tr.status = 'complete' AND tr.assigned_to IS NOT NULL";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND tr.completed_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND tr.completed_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    if (floor) {
      whereClause += ` AND tr.origin_floor = $${paramIndex++}`;
      params.push(floor);
    }

    if (transporter_id) {
      whereClause += ` AND tr.assigned_to = $${paramIndex++}`;
      params.push(transporter_id);
    }

    // Get job time per transporter
    const jobTimeResult = await query(
      `SELECT
        tr.assigned_to as user_id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(EXTRACT(EPOCH FROM (tr.completed_at - tr.accepted_at))), 0) as job_time_seconds
       FROM transport_requests tr
       JOIN users u ON tr.assigned_to = u.id
       ${whereClause}
       GROUP BY tr.assigned_to, u.first_name, u.last_name`,
      params
    );

    // Build date filter for shift_logs and audit_logs
    let shiftWhereClause = 'WHERE sl.shift_end IS NOT NULL';
    const shiftParams: unknown[] = [];
    let shiftParamIndex = 1;

    if (start_date) {
      shiftWhereClause += ` AND sl.shift_start >= $${shiftParamIndex++}`;
      shiftParams.push(start_date);
    }

    if (end_date) {
      shiftWhereClause += ` AND sl.shift_end <= $${shiftParamIndex++}`;
      shiftParams.push(end_date);
    }

    if (transporter_id) {
      shiftWhereClause += ` AND sl.user_id = $${shiftParamIndex++}`;
      shiftParams.push(transporter_id);
    }

    // Get total shift duration per transporter
    const shiftTimeResult = await query(
      `SELECT
        sl.user_id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(EXTRACT(EPOCH FROM (sl.shift_end - sl.shift_start))), 0) as shift_duration_seconds
       FROM shift_logs sl
       JOIN users u ON sl.user_id = u.id
       ${shiftWhereClause}
       GROUP BY sl.user_id, u.first_name, u.last_name`,
      shiftParams
    );

    // Get break time from audit_logs (status changes to/from on_break)
    // Uses correlated subquery to find next status change and caps unclosed breaks at 1 hour
    const breakParams: unknown[] = [];
    let breakParamIndex = 1;

    let breakDateFilter = '';
    if (start_date) {
      breakDateFilter += ` AND al.timestamp >= $${breakParamIndex++}`;
      breakParams.push(start_date);
    }
    if (end_date) {
      breakDateFilter += ` AND al.timestamp <= $${breakParamIndex++}`;
      breakParams.push(end_date);
    }

    let breakUserFilter = '';
    if (transporter_id) {
      breakUserFilter = ` AND al.user_id = $${breakParamIndex++}`;
      breakParams.push(transporter_id);
    }

    // Calculate break time by finding pairs of on_break start/end with 1-hour cap
    const breakTimeResult = await query(
      `WITH break_periods AS (
        SELECT
          al.user_id,
          al.timestamp as break_start,
          (
            SELECT MIN(al2.timestamp)
            FROM audit_logs al2
            WHERE al2.user_id = al.user_id
              AND al2.timestamp > al.timestamp
              AND al2.action = 'status_change'
              AND al2.entity_type = 'transporter_status'
              AND al2.new_values->>'status' != 'on_break'
          ) as break_end
        FROM audit_logs al
        WHERE al.action = 'status_change'
          AND al.entity_type = 'transporter_status'
          AND al.new_values->>'status' = 'on_break'
          ${breakDateFilter}
          ${breakUserFilter}
      )
      SELECT
        bp.user_id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(
          CASE
            WHEN bp.break_end IS NULL THEN LEAST(3600, EXTRACT(EPOCH FROM (NOW() - bp.break_start)))
            ELSE LEAST(3600, EXTRACT(EPOCH FROM (bp.break_end - bp.break_start)))
          END
        ), 0) as break_time_seconds
      FROM break_periods bp
      JOIN users u ON bp.user_id = u.id
      GROUP BY bp.user_id, u.first_name, u.last_name`,
      breakParams
    );

    // Get "other" time from audit_logs (status changes to/from other)
    // Uses same logic as break time with 1-hour cap
    const otherParams: unknown[] = [];
    let otherParamIndex = 1;

    let otherDateFilter = '';
    if (start_date) {
      otherDateFilter += ` AND al.timestamp >= $${otherParamIndex++}`;
      otherParams.push(start_date);
    }
    if (end_date) {
      otherDateFilter += ` AND al.timestamp <= $${otherParamIndex++}`;
      otherParams.push(end_date);
    }

    let otherUserFilter = '';
    if (transporter_id) {
      otherUserFilter = ` AND al.user_id = $${otherParamIndex++}`;
      otherParams.push(transporter_id);
    }

    const otherTimeResult = await query(
      `WITH other_periods AS (
        SELECT
          al.user_id,
          al.timestamp as other_start,
          (
            SELECT MIN(al2.timestamp)
            FROM audit_logs al2
            WHERE al2.user_id = al.user_id
              AND al2.timestamp > al.timestamp
              AND al2.action = 'status_change'
              AND al2.entity_type = 'transporter_status'
              AND al2.new_values->>'status' != 'other'
          ) as other_end
        FROM audit_logs al
        WHERE al.action = 'status_change'
          AND al.entity_type = 'transporter_status'
          AND al.new_values->>'status' = 'other'
          ${otherDateFilter}
          ${otherUserFilter}
      )
      SELECT
        op.user_id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(
          CASE
            WHEN op.other_end IS NULL THEN LEAST(3600, EXTRACT(EPOCH FROM (NOW() - op.other_start)))
            ELSE LEAST(3600, EXTRACT(EPOCH FROM (op.other_end - op.other_start)))
          END
        ), 0) as other_time_seconds
      FROM other_periods op
      JOIN users u ON op.user_id = u.id
      GROUP BY op.user_id, u.first_name, u.last_name`,
      otherParams
    );

    // Get offline time from offline_periods table
    const offlineParams: unknown[] = [];
    let offlineParamIndex = 1;
    let offlineDateFilter = '';
    if (start_date) {
      offlineDateFilter += ` AND op.offline_at >= $${offlineParamIndex++}`;
      offlineParams.push(start_date);
    }
    if (end_date) {
      offlineDateFilter += ` AND op.offline_at <= $${offlineParamIndex++}`;
      offlineParams.push(end_date);
    }
    let offlineUserFilter = '';
    if (transporter_id) {
      offlineUserFilter = ` AND op.user_id = $${offlineParamIndex++}`;
      offlineParams.push(transporter_id);
    }

    const offlineTimeResult = await query(
      `SELECT
        op.user_id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(
          CASE
            WHEN op.duration_seconds IS NOT NULL THEN LEAST(op.duration_seconds, 28800)
            WHEN op.online_at IS NULL THEN LEAST(28800, EXTRACT(EPOCH FROM (NOW() - op.offline_at))::int)
            ELSE LEAST(28800, EXTRACT(EPOCH FROM (op.online_at - op.offline_at))::int)
          END
        ), 0) as offline_time_seconds
      FROM offline_periods op
      JOIN users u ON op.user_id = u.id
      LEFT JOIN shift_logs sl ON op.user_id = sl.user_id
        AND op.offline_at >= sl.shift_start
        AND op.offline_at <= COALESCE(sl.shift_end, NOW())
      WHERE (sl.shift_end IS NOT NULL OR sl.id IS NULL)
        ${offlineDateFilter} ${offlineUserFilter}
      GROUP BY op.user_id, u.first_name, u.last_name`,
      offlineParams
    );

    // Combine all data
    const userMap = new Map<number, {
      user_id: number;
      first_name: string;
      last_name: string;
      job_time_seconds: number;
      break_time_seconds: number;
      other_time_seconds: number;
      offline_time_seconds: number;
      shift_duration_seconds: number;
      down_time_seconds: number;
    }>();

    // Helper to get or create user entry
    const getOrCreate = (userId: number, firstName: string, lastName: string) => {
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          job_time_seconds: 0,
          break_time_seconds: 0,
          other_time_seconds: 0,
          offline_time_seconds: 0,
          shift_duration_seconds: 0,
          down_time_seconds: 0,
        });
      }
      return userMap.get(userId)!;
    };

    // Initialize with job time data
    for (const row of jobTimeResult.rows) {
      const entry = getOrCreate(row.user_id, row.first_name, row.last_name);
      entry.job_time_seconds = parseFloat(row.job_time_seconds) || 0;
    }

    // Add shift data
    for (const row of shiftTimeResult.rows) {
      const entry = getOrCreate(row.user_id, row.first_name, row.last_name);
      entry.shift_duration_seconds = parseFloat(row.shift_duration_seconds) || 0;
    }

    // Add break data
    for (const row of breakTimeResult.rows) {
      const entry = getOrCreate(row.user_id, row.first_name, row.last_name);
      entry.break_time_seconds = parseFloat(row.break_time_seconds) || 0;
    }

    // Add other time data
    for (const row of otherTimeResult.rows) {
      const entry = getOrCreate(row.user_id, row.first_name, row.last_name);
      entry.other_time_seconds = parseFloat(row.other_time_seconds) || 0;
    }

    // Add offline time data
    for (const row of offlineTimeResult.rows) {
      const entry = getOrCreate(row.user_id, row.first_name, row.last_name);
      entry.offline_time_seconds = parseFloat(row.offline_time_seconds) || 0;
    }

    // Calculate down time: shift_duration - job_time - break_time - other_time - offline_time
    const transporters = Array.from(userMap.values()).map(t => ({
      ...t,
      down_time_seconds: Math.max(0, t.shift_duration_seconds - t.job_time_seconds - t.break_time_seconds - t.other_time_seconds - t.offline_time_seconds),
    }));

    // Calculate totals
    const totals = transporters.reduce(
      (acc, t) => ({
        total_job_time_seconds: acc.total_job_time_seconds + t.job_time_seconds,
        total_break_time_seconds: acc.total_break_time_seconds + t.break_time_seconds,
        total_other_time_seconds: acc.total_other_time_seconds + t.other_time_seconds,
        total_offline_time_seconds: acc.total_offline_time_seconds + t.offline_time_seconds,
        total_down_time_seconds: acc.total_down_time_seconds + t.down_time_seconds,
      }),
      { total_job_time_seconds: 0, total_break_time_seconds: 0, total_other_time_seconds: 0, total_offline_time_seconds: 0, total_down_time_seconds: 0 }
    );

    res.json({
      transporters,
      totals,
    });
  } catch (error) {
    logger.error('Get time metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get cycle time rolling averages
export const getCycleTimeAverages = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT phase, average_minutes, sample_count, updated_at
       FROM cycle_time_averages
       ORDER BY phase`
    );

    const thresholdPct = await query(
      "SELECT value FROM system_config WHERE key = 'cycle_time_threshold_percentage'"
    );
    const pct = thresholdPct.rows.length > 0
      ? parseInt(typeof thresholdPct.rows[0].value === 'string' ? JSON.parse(thresholdPct.rows[0].value) : thresholdPct.rows[0].value, 10) || 30
      : 30;

    const averages = result.rows.map((row: { phase: string; average_minutes: string; sample_count: string; updated_at: string }) => ({
      phase: row.phase,
      average_minutes: parseFloat(row.average_minutes) || 0,
      alert_threshold_minutes: (parseFloat(row.average_minutes) || 0) * (1 + pct / 100),
      sample_count: parseInt(row.sample_count) || 0,
      updated_at: row.updated_at,
    }));

    res.json({ averages, threshold_percentage: pct });
  } catch (error) {
    logger.error('Get cycle time averages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get jobs by day of week (aggregated across date range)
export const getJobsByDay = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date, floor, transporter_id } = req.query;

    let whereClause = "WHERE status = 'complete'";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    if (floor) {
      whereClause += ` AND origin_floor = $${paramIndex++}`;
      params.push(floor);
    }

    if (transporter_id) {
      whereClause += ` AND assigned_to = $${paramIndex++}`;
      params.push(transporter_id);
    }

    // Aggregate jobs by day of week (0=Sun, 1=Mon, ..., 6=Sat in PostgreSQL)
    const result = await query(
      `WITH days_of_week AS (
        SELECT unnest(ARRAY[0, 1, 2, 3, 4, 5, 6]) AS dow
      ),
      job_counts AS (
        SELECT EXTRACT(DOW FROM created_at)::int AS dow, COUNT(*) as count
        FROM transport_requests
        ${whereClause}
        GROUP BY EXTRACT(DOW FROM created_at)
      )
      SELECT
        dw.dow,
        COALESCE(jc.count, 0) as count
      FROM days_of_week dw
      LEFT JOIN job_counts jc ON dw.dow = jc.dow
      ORDER BY CASE WHEN dw.dow = 0 THEN 7 ELSE dw.dow END`,
      params
    );

    // Map day of week numbers to names (ordered Mon-Sun)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const jobsByDay = result.rows.map(row => ({
      date: dayNames[row.dow],
      count: parseInt(row.count),
    }));

    res.json({ jobsByDay });
  } catch (error) {
    logger.error('Get jobs by day error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get delay report (by reason + by transporter)
export const getDelayReport = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND rd.created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND rd.created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    // By reason
    const byReasonResult = await query(
      `SELECT rd.reason, COUNT(*) as count
       FROM request_delays rd
       ${whereClause}
       GROUP BY rd.reason
       ORDER BY count DESC`,
      params
    );

    // By transporter
    const byTransporterResult = await query(
      `SELECT rd.user_id, u.first_name, u.last_name, rd.reason, COUNT(*) as count
       FROM request_delays rd
       LEFT JOIN users u ON rd.user_id = u.id
       ${whereClause}
       GROUP BY rd.user_id, u.first_name, u.last_name, rd.reason
       ORDER BY u.last_name, u.first_name`,
      params
    );

    const byReason = byReasonResult.rows.map((row) => ({
      reason: row.reason,
      count: parseInt(row.count),
    }));

    // Group by transporter
    const transporterMap = new Map<number, {
      user_id: number;
      first_name: string;
      last_name: string;
      total_delays: number;
      reasons: { reason: string; count: number }[];
    }>();

    for (const row of byTransporterResult.rows) {
      const userId = row.user_id;
      if (!transporterMap.has(userId)) {
        transporterMap.set(userId, {
          user_id: userId,
          first_name: row.first_name || 'Unknown',
          last_name: row.last_name || '',
          total_delays: 0,
          reasons: [],
        });
      }
      const entry = transporterMap.get(userId)!;
      const count = parseInt(row.count);
      entry.total_delays += count;
      entry.reasons.push({ reason: row.reason, count });
    }

    const byTransporter = Array.from(transporterMap.values())
      .sort((a, b) => b.total_delays - a.total_delays);

    res.json({ byReason, byTransporter });
  } catch (error) {
    logger.error('Get delay report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get detailed floor analysis
export const getFloorAnalysis = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    const floors = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
    const floorData = [];

    for (const floor of floors) {
      const floorWhere = `${whereClause} AND origin_floor = $${paramIndex}`;
      const floorParams = [...params, floor];

      // Get aggregate stats (excluding PCT transfers from timing calculations)
      const statsResult = await query(
        `SELECT
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE status = 'transferred_to_pct') as pct_transfers,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          AVG(EXTRACT(EPOCH FROM (accepted_at - created_at)) / 60)
            FILTER (WHERE status = 'complete') as avg_response_time,
          AVG(EXTRACT(EPOCH FROM (with_patient_at - created_at)) / 60)
            FILTER (WHERE status = 'complete') as avg_pickup_time,
          AVG(EXTRACT(EPOCH FROM (completed_at - with_patient_at)) / 60)
            FILTER (WHERE status = 'complete') as avg_transport_time,
          AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60)
            FILTER (WHERE status = 'complete') as avg_cycle_time
         FROM transport_requests
         ${floorWhere}`,
        floorParams
      );

      const stats = statsResult.rows[0];
      const totalRequests = parseInt(stats.total_requests) || 0;
      const pctTransfers = parseInt(stats.pct_transfers) || 0;

      floorData.push({
        floor,
        total_requests: totalRequests,
        avg_response_time: parseFloat(stats.avg_response_time) || 0,
        avg_pickup_time: parseFloat(stats.avg_pickup_time) || 0,
        avg_transport_time: parseFloat(stats.avg_transport_time) || 0,
        avg_cycle_time: parseFloat(stats.avg_cycle_time) || 0,
        pct_transferred: totalRequests > 0 ? (pctTransfers / totalRequests) * 100 : 0,
        cancelled_count: parseInt(stats.cancelled) || 0,
      });
    }

    res.json({ floors: floorData });
  } catch (error) {
    logger.error('Get floor analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get activity log (audit_logs for transport_requests)
export const getActivityLog = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { start_date, end_date, transporter_id, status, floor, search, page = '1', limit = '50' } = req.query;

    let whereClause = "WHERE al.entity_type = 'transport_request'";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (start_date) {
      whereClause += ` AND al.timestamp >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ` AND al.timestamp <= $${paramIndex++}`;
      params.push(end_date);
    }
    if (transporter_id) {
      whereClause += ` AND al.user_id = $${paramIndex++}`;
      params.push(transporter_id);
    }
    if (status) {
      whereClause += ` AND al.new_values->>'status' = $${paramIndex++}`;
      params.push(status);
    }
    if (floor) {
      whereClause += ` AND tr.origin_floor = $${paramIndex++}`;
      params.push(floor);
    }
    if (search) {
      whereClause += ` AND (tr.room_number ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM audit_logs al
       LEFT JOIN transport_requests tr ON al.entity_id = tr.id
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total) || 0;

    // Get paginated results
    const result = await query(
      `SELECT al.*,
              u.first_name as actor_first_name,
              u.last_name as actor_last_name,
              tr.origin_floor,
              tr.room_number,
              tr.destination,
              tr.priority,
              tr.status as request_status
       FROM audit_logs al
       LEFT JOIN transport_requests tr ON al.entity_id = tr.id
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limitNum, offset]
    );

    const entries = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      action: row.action,
      timestamp: row.timestamp,
      old_values: row.old_values,
      new_values: row.new_values,
      actor: row.actor_first_name
        ? { first_name: row.actor_first_name, last_name: row.actor_last_name }
        : null,
      request: row.origin_floor
        ? {
            id: row.entity_id,
            origin_floor: row.origin_floor,
            room_number: row.room_number,
            destination: row.destination,
            priority: row.priority,
            status: row.request_status,
          }
        : null,
    }));

    res.json({
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get activity log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
