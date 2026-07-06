import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

// Set DATABASE_CA_CERT to the Supabase CA certificate (PEM) to enable full
// certificate verification; without it we fall back to unverified TLS, which
// the Supabase pooler historically required.
const ssl = process.env.DATABASE_CA_CERT
  ? { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true }
  : { rejectUnauthorized: false };

if (!process.env.DATABASE_CA_CERT) {
  logger.warn('DATABASE_CA_CERT not set — TLS certificate verification is disabled');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Idle clients can be dropped by the Supabase pooler; pg discards the broken
// connection and creates a fresh one on the next checkout, so don't exit.
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
  }
  return res;
};

export const getClient = () => pool.connect();

// Run fn's queries on a single client inside BEGIN/COMMIT, rolling back on error.
export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
