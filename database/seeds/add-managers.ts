import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load env from server directory
dotenv.config({ path: './server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SALT_ROUNDS = 12;

async function addManagers() {
  console.log('Adding 4 new manager accounts...');

  const client = await pool.connect();

  try {
    const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS);

    const managers = [
      { email: 'manager2@fcc.test', first_name: 'Michael', last_name: 'Brown' },
      { email: 'manager3@fcc.test', first_name: 'Emily', last_name: 'Davis' },
      { email: 'manager4@fcc.test', first_name: 'David', last_name: 'Wilson' },
      { email: 'manager5@fcc.test', first_name: 'Jennifer', last_name: 'Martinez' },
    ];

    for (const manager of managers) {
      // Check if user already exists
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [manager.email]
      );

      if (existing.rows.length > 0) {
        console.log(`Manager ${manager.email} already exists, skipping...`);
        continue;
      }

      await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, include_in_analytics)
         VALUES ($1, $2, $3, $4, 'manager', true, true)`,
        [manager.email, passwordHash, manager.first_name, manager.last_name]
      );
      console.log(`Created manager: ${manager.first_name} ${manager.last_name} (${manager.email})`);
    }

    console.log('\nManager accounts created successfully!');
    console.log('\nNew manager accounts (all use password: password123):');
    console.log('  manager2@fcc.test - Michael Brown');
    console.log('  manager3@fcc.test - Emily Davis');
    console.log('  manager4@fcc.test - David Wilson');
    console.log('  manager5@fcc.test - Jennifer Martinez');
  } catch (error) {
    console.error('Failed to add managers:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addManagers();
