import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load env from server directory
dotenv.config({ path: '../server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const SALT_ROUNDS = 12;

async function seed() {
  console.log('Starting seed...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM status_history');
    await client.query('DELETE FROM transport_requests');
    await client.query('DELETE FROM transporter_status');
    await client.query('DELETE FROM users');

    // Reset sequences
    await client.query("SELECT setval('users_id_seq', 1, false)");
    await client.query("SELECT setval('transporter_status_id_seq', 1, false)");
    await client.query("SELECT setval('transport_requests_id_seq', 1, false)");
    await client.query("SELECT setval('status_history_id_seq', 1, false)");

    const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS);

    // Create users
    const users = [
      // Manager
      { email: 'manager@fcc.test', first_name: 'Sarah', last_name: 'Johnson', role: 'manager' },
      // Supervisors
      { email: 'supervisor1@fcc.test', first_name: 'Michael', last_name: 'Chen', role: 'supervisor' },
      { email: 'supervisor2@fcc.test', first_name: 'Emily', last_name: 'Williams', role: 'supervisor' },
      // Dispatchers
      { email: 'dispatcher1@fcc.test', first_name: 'David', last_name: 'Martinez', role: 'dispatcher' },
      { email: 'dispatcher2@fcc.test', first_name: 'Jessica', last_name: 'Brown', role: 'dispatcher' },
      { email: 'dispatcher3@fcc.test', first_name: 'Robert', last_name: 'Taylor', role: 'dispatcher' },
      { email: 'dispatcher4@fcc.test', first_name: 'Amanda', last_name: 'Davis', role: 'dispatcher' },
      // Transporters
      { email: 'transporter1@fcc.test', first_name: 'James', last_name: 'Wilson', role: 'transporter' },
      { email: 'transporter2@fcc.test', first_name: 'Maria', last_name: 'Garcia', role: 'transporter' },
      { email: 'transporter3@fcc.test', first_name: 'Thomas', last_name: 'Anderson', role: 'transporter' },
      { email: 'transporter4@fcc.test', first_name: 'Linda', last_name: 'Thomas', role: 'transporter' },
      { email: 'transporter5@fcc.test', first_name: 'Kevin', last_name: 'Jackson', role: 'transporter' },
    ];

    const userIds: Record<string, number> = {};

    for (const user of users) {
      const result = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [user.email, passwordHash, user.first_name, user.last_name, user.role]
      );
      userIds[user.email] = result.rows[0].id;
      console.log(`Created user: ${user.first_name} ${user.last_name} (${user.role})`);
    }

    // Create transporter status records
    const transporterEmails = [
      'transporter1@fcc.test',
      'transporter2@fcc.test',
      'transporter3@fcc.test',
      'transporter4@fcc.test',
      'transporter5@fcc.test',
    ];

    for (const email of transporterEmails) {
      await client.query(
        `INSERT INTO transporter_status (user_id, status)
         VALUES ($1, 'offline')`,
        [userIds[email]]
      );
    }

    console.log('Created transporter status records');

    // Create sample completed transport requests
    const now = new Date();
    const requests = [
      {
        origin_floor: 'FCC4',
        room_number: '412',
        patient_initials: 'JD',
        destination: 'Atrium',
        priority: 'routine',
        special_needs: ['wheelchair'],
        created_by: userIds['dispatcher1@fcc.test'],
        assigned_to: userIds['transporter1@fcc.test'],
        created_offset: -180, // 3 hours ago
        cycle_time: 12, // 12 minutes total
      },
      {
        origin_floor: 'FCC5',
        room_number: '523',
        patient_initials: 'AS',
        destination: 'Atrium',
        priority: 'stat',
        special_needs: ['o2', 'iv_pump'],
        created_by: userIds['dispatcher2@fcc.test'],
        assigned_to: userIds['transporter2@fcc.test'],
        created_offset: -150,
        cycle_time: 8,
      },
      {
        origin_floor: 'FCC6',
        room_number: '601',
        patient_initials: 'MK',
        destination: 'Atrium',
        priority: 'routine',
        special_needs: [],
        created_by: userIds['dispatcher1@fcc.test'],
        assigned_to: userIds['transporter3@fcc.test'],
        created_offset: -120,
        cycle_time: 15,
      },
      {
        origin_floor: 'FCC1',
        room_number: '108',
        patient_initials: 'LT',
        destination: 'Atrium',
        priority: 'routine',
        special_needs: ['wheelchair', 'o2'],
        created_by: userIds['dispatcher3@fcc.test'],
        assigned_to: userIds['transporter1@fcc.test'],
        created_offset: -100,
        cycle_time: 10,
      },
      {
        origin_floor: 'FCC4',
        room_number: '445',
        patient_initials: 'RB',
        destination: 'Other - Radiology',
        priority: 'stat',
        special_needs: ['iv_pump'],
        created_by: userIds['dispatcher2@fcc.test'],
        assigned_to: userIds['transporter4@fcc.test'],
        created_offset: -80,
        cycle_time: 6,
      },
      {
        origin_floor: 'FCC5',
        room_number: '510',
        patient_initials: 'EP',
        destination: 'Atrium',
        priority: 'routine',
        special_needs: [],
        created_by: userIds['dispatcher4@fcc.test'],
        assigned_to: userIds['transporter5@fcc.test'],
        created_offset: -60,
        cycle_time: 11,
      },
      {
        origin_floor: 'FCC6',
        room_number: '622',
        patient_initials: 'CH',
        destination: 'Atrium',
        priority: 'routine',
        special_needs: ['wheelchair'],
        created_by: userIds['dispatcher1@fcc.test'],
        assigned_to: userIds['transporter2@fcc.test'],
        created_offset: -45,
        cycle_time: 14,
      },
      {
        origin_floor: 'FCC1',
        room_number: '115',
        patient_initials: 'NW',
        destination: 'Atrium',
        priority: 'stat',
        special_needs: ['o2'],
        created_by: userIds['dispatcher3@fcc.test'],
        assigned_to: userIds['transporter3@fcc.test'],
        created_offset: -30,
        cycle_time: 7,
      },
      {
        origin_floor: 'FCC4',
        room_number: '430',
        patient_initials: 'SL',
        destination: 'Atrium',
        priority: 'routine',
        special_needs: [],
        created_by: userIds['dispatcher2@fcc.test'],
        assigned_to: userIds['transporter1@fcc.test'],
        created_offset: -20,
        cycle_time: 9,
      },
      {
        origin_floor: 'FCC5',
        room_number: '555',
        patient_initials: 'GF',
        destination: 'Other - Lab',
        priority: 'routine',
        special_needs: ['iv_pump'],
        created_by: userIds['dispatcher4@fcc.test'],
        assigned_to: userIds['transporter4@fcc.test'],
        created_offset: -10,
        cycle_time: 13,
      },
    ];

    for (const req of requests) {
      const created_at = new Date(now.getTime() + req.created_offset * 60000);
      const assigned_at = new Date(created_at.getTime() + 30000); // 30 sec after creation
      const accepted_at = new Date(assigned_at.getTime() + 60000); // 1 min after assignment
      const en_route_at = new Date(accepted_at.getTime() + 30000); // 30 sec after accept
      const with_patient_at = new Date(en_route_at.getTime() + (req.cycle_time * 60000 * 0.4)); // 40% of cycle
      const completed_at = new Date(created_at.getTime() + req.cycle_time * 60000);

      const result = await client.query(
        `INSERT INTO transport_requests
         (origin_floor, room_number, patient_initials, destination, priority,
          special_needs, status, created_by, assigned_to,
          created_at, assigned_at, accepted_at, en_route_at, with_patient_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'complete', $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
          req.origin_floor,
          req.room_number,
          req.patient_initials,
          req.destination,
          req.priority,
          JSON.stringify(req.special_needs),
          req.created_by,
          req.assigned_to,
          created_at.toISOString(),
          assigned_at.toISOString(),
          accepted_at.toISOString(),
          en_route_at.toISOString(),
          with_patient_at.toISOString(),
          completed_at.toISOString(),
        ]
      );

      // Create status history
      const requestId = result.rows[0].id;
      const histories = [
        { from: null, to: 'assigned', time: assigned_at },
        { from: 'assigned', to: 'accepted', time: accepted_at },
        { from: 'accepted', to: 'en_route', time: en_route_at },
        { from: 'en_route', to: 'with_patient', time: with_patient_at },
        { from: 'with_patient', to: 'complete', time: completed_at },
      ];

      for (const h of histories) {
        await client.query(
          `INSERT INTO status_history (request_id, user_id, from_status, to_status, timestamp)
           VALUES ($1, $2, $3, $4, $5)`,
          [requestId, req.assigned_to, h.from, h.to, h.time.toISOString()]
        );
      }

      console.log(`Created request: ${req.origin_floor} ${req.room_number} (${req.priority})`);
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully!');
    console.log('\nTest accounts (all use password: password123):');
    console.log('  Manager: manager@fcc.test');
    console.log('  Supervisor: supervisor1@fcc.test');
    console.log('  Dispatcher: dispatcher1@fcc.test');
    console.log('  Transporter: transporter1@fcc.test');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
