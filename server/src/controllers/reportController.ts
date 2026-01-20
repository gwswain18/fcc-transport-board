import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';

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
    console.error('Get summary error:', error);
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
    console.error('Get by transporter error:', error);
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
    console.error('Get jobs by hour error:', error);
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
    console.error('Get jobs by floor error:', error);
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
        tr.patient_initials,
        tr.destination,
        tr.priority,
        tr.special_needs,
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
      'ID', 'Floor', 'Room', 'Initials', 'Destination', 'Priority',
      'Special Needs', 'Status', 'Created At', 'Assigned At', 'Accepted At',
      'En Route At', 'With Patient At', 'Completed At', 'Cancelled At',
      'Created By', 'Assigned To'
    ];

    const rows = result.rows.map((row) => [
      row.id,
      row.origin_floor,
      row.room_number,
      row.patient_initials || '',
      row.destination,
      row.priority,
      JSON.stringify(row.special_needs),
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
    console.error('Export data error:', error);
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
    console.error('Get staffing by floor error:', error);
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
    let breakWhereClause = `WHERE al.action = 'status_change'
       AND al.entity_type = 'transporter_status'
       AND al.new_values->>'status' = 'on_break'`;
    const breakParams: unknown[] = [];
    let breakParamIndex = 1;

    if (start_date) {
      breakWhereClause += ` AND al.timestamp >= $${breakParamIndex++}`;
      breakParams.push(start_date);
    }

    if (end_date) {
      breakWhereClause += ` AND al.timestamp <= $${breakParamIndex++}`;
      breakParams.push(end_date);
    }

    if (transporter_id) {
      breakWhereClause += ` AND al.user_id = $${breakParamIndex++}`;
      breakParams.push(transporter_id);
    }

    // Calculate break time by finding pairs of on_break start/end
    const breakTimeResult = await query(
      `WITH break_starts AS (
        SELECT
          al.user_id,
          al.timestamp as break_start,
          LEAD(al2.timestamp) OVER (PARTITION BY al.user_id ORDER BY al.timestamp) as break_end
        FROM audit_logs al
        LEFT JOIN audit_logs al2 ON al.user_id = al2.user_id
          AND al2.timestamp > al.timestamp
          AND al2.action = 'status_change'
          AND al2.entity_type = 'transporter_status'
          AND al2.new_values->>'status' != 'on_break'
        ${breakWhereClause}
      )
      SELECT
        bs.user_id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(bs.break_end, NOW()) - bs.break_start))), 0) as break_time_seconds
      FROM break_starts bs
      JOIN users u ON bs.user_id = u.id
      WHERE bs.break_end IS NOT NULL OR bs.break_start > NOW() - INTERVAL '24 hours'
      GROUP BY bs.user_id, u.first_name, u.last_name`,
      breakParams
    );

    // Combine all data
    const userMap = new Map<number, {
      user_id: number;
      first_name: string;
      last_name: string;
      job_time_seconds: number;
      break_time_seconds: number;
      shift_duration_seconds: number;
      available_time_seconds: number;
    }>();

    // Initialize with job time data
    for (const row of jobTimeResult.rows) {
      userMap.set(row.user_id, {
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        job_time_seconds: parseFloat(row.job_time_seconds) || 0,
        break_time_seconds: 0,
        shift_duration_seconds: 0,
        available_time_seconds: 0,
      });
    }

    // Add shift data
    for (const row of shiftTimeResult.rows) {
      const existing = userMap.get(row.user_id);
      if (existing) {
        existing.shift_duration_seconds = parseFloat(row.shift_duration_seconds) || 0;
      } else {
        userMap.set(row.user_id, {
          user_id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          job_time_seconds: 0,
          break_time_seconds: 0,
          shift_duration_seconds: parseFloat(row.shift_duration_seconds) || 0,
          available_time_seconds: 0,
        });
      }
    }

    // Add break data
    for (const row of breakTimeResult.rows) {
      const existing = userMap.get(row.user_id);
      if (existing) {
        existing.break_time_seconds = parseFloat(row.break_time_seconds) || 0;
      } else {
        userMap.set(row.user_id, {
          user_id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          job_time_seconds: 0,
          break_time_seconds: parseFloat(row.break_time_seconds) || 0,
          shift_duration_seconds: 0,
          available_time_seconds: 0,
        });
      }
    }

    // Calculate available time
    const transporters = Array.from(userMap.values()).map(t => ({
      ...t,
      available_time_seconds: Math.max(0, t.shift_duration_seconds - t.job_time_seconds - t.break_time_seconds),
    }));

    // Calculate totals
    const totals = transporters.reduce(
      (acc, t) => ({
        total_job_time_seconds: acc.total_job_time_seconds + t.job_time_seconds,
        total_break_time_seconds: acc.total_break_time_seconds + t.break_time_seconds,
        total_available_time_seconds: acc.total_available_time_seconds + t.available_time_seconds,
      }),
      { total_job_time_seconds: 0, total_break_time_seconds: 0, total_available_time_seconds: 0 }
    );

    res.json({
      transporters,
      totals,
    });
  } catch (error) {
    console.error('Get time metrics error:', error);
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
    console.error('Get floor analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
