import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import pool from './database.js';

const migrationsDir = join(process.cwd(), '..', 'database', 'migrations');

async function runMigrations() {
  console.log('Running migrations...');

  // Create migrations tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get list of executed migrations
  const { rows: executed } = await pool.query('SELECT name FROM _migrations');
  const executedNames = new Set(executed.map((r) => r.name));

  // Get migration files
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (executedNames.has(file)) {
      console.log(`Skipping ${file} (already executed)`);
      continue;
    }

    console.log(`Running migration: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Completed: ${file}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`Failed to run migration ${file}:`, error);
      process.exit(1);
    }
  }

  console.log('All migrations completed!');
  await pool.end();
}

runMigrations();
