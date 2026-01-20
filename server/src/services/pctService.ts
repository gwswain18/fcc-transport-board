import { query } from '../config/database.js';
import { getIO } from '../socket/index.js';

// Check interval in milliseconds (every minute)
const CHECK_INTERVAL = 60000;

let intervalId: NodeJS.Timeout | null = null;

/**
 * Starts the PCT auto-close background job.
 * This job checks for PCT-transferred requests that have passed their auto-close time
 * and automatically marks them as complete.
 */
export const startPCTAutoCloseJob = (): void => {
  if (intervalId) {
    console.log('PCT auto-close job already running');
    return;
  }

  console.log('Starting PCT auto-close job');

  intervalId = setInterval(async () => {
    await processPCTAutoClose();
  }, CHECK_INTERVAL);

  // Also run immediately on start
  processPCTAutoClose();
};

/**
 * Stops the PCT auto-close background job.
 */
export const stopPCTAutoCloseJob = (): void => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('PCT auto-close job stopped');
  }
};

/**
 * Process all PCT requests that need to be auto-closed.
 */
const processPCTAutoClose = async (): Promise<void> => {
  try {
    // Find all PCT requests that have passed their auto-close time
    const result = await query(
      `SELECT id, origin_floor, room_number
       FROM transport_requests
       WHERE status = 'transferred_to_pct'
         AND pct_auto_close_at IS NOT NULL
         AND pct_auto_close_at <= CURRENT_TIMESTAMP`
    );

    if (result.rows.length === 0) {
      return;
    }

    console.log(`Auto-closing ${result.rows.length} PCT request(s)`);

    for (const request of result.rows) {
      await autoClosePCTRequest(request.id);
    }
  } catch (error) {
    console.error('PCT auto-close job error:', error);
  }
};

/**
 * Auto-close a single PCT request.
 */
const autoClosePCTRequest = async (requestId: number): Promise<void> => {
  try {
    // Update the request to complete
    await query(
      `UPDATE transport_requests
       SET status = 'complete',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );

    // Record status history (using system user ID 0 or null for automated actions)
    await query(
      `INSERT INTO status_history (request_id, user_id, from_status, to_status)
       VALUES ($1, NULL, 'transferred_to_pct', 'complete')`,
      [requestId]
    );

    // Emit socket event
    const io = getIO();
    if (io) {
      const updatedResult = await query(
        `SELECT tr.*,
                creator.first_name as creator_first_name,
                creator.last_name as creator_last_name
         FROM transport_requests tr
         LEFT JOIN users creator ON tr.created_by = creator.id
         WHERE tr.id = $1`,
        [requestId]
      );

      if (updatedResult.rows.length > 0) {
        const row = updatedResult.rows[0];
        const request = {
          ...row,
          creator: {
            id: row.created_by,
            first_name: row.creator_first_name,
            last_name: row.creator_last_name,
          },
          assignee: null,
        };
        io.emit('request_status_changed', request);
      }
    }

    console.log(`Auto-closed PCT request ${requestId}`);
  } catch (error) {
    console.error(`Failed to auto-close PCT request ${requestId}:`, error);
  }
};
