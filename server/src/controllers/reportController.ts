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
    const { start_date, end_date } = req.query;

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
    const { start_date, end_date } = req.query;

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
