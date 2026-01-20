const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migrations = [
  // Migration 005: Enhance users
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_floor floor_type;`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS include_in_analytics BOOLEAN NOT NULL DEFAULT true;`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temp_account BOOLEAN NOT NULL DEFAULT false;`,
  `CREATE INDEX IF NOT EXISTS idx_users_primary_floor ON users(primary_floor);`,

  // Migration 006: Shift tracking
  `CREATE TABLE IF NOT EXISTS shift_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    shift_start TIMESTAMP WITH TIME ZONE NOT NULL,
    shift_end TIMESTAMP WITH TIME ZONE,
    extension VARCHAR(50),
    floor_assignment floor_type,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS idx_shift_logs_user_id ON shift_logs(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_shift_logs_shift_start ON shift_logs(shift_start);`,

  // Migration 007: System config and cycle time averages
  `CREATE TABLE IF NOT EXISTS cycle_time_averages (
    id SERIAL PRIMARY KEY,
    phase VARCHAR(50) NOT NULL,
    floor floor_type,
    avg_seconds DECIMAL(10,2) NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phase, floor)
  );`,
  `CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,
  `INSERT INTO system_config (key, value) VALUES
    ('cycle_time_sample_size', '50'),
    ('cycle_time_threshold_percentage', '30'),
    ('heartbeat_timeout_ms', '120000'),
    ('auto_assign_acceptance_timeout_ms', '120000'),
    ('break_alert_minutes', '30')
  ON CONFLICT (key) DO NOTHING;`,

  // Migration 008: Heartbeat tracking
  `CREATE TABLE IF NOT EXISTS user_heartbeats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    socket_id VARCHAR(100)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_user_heartbeats_last_heartbeat ON user_heartbeats(last_heartbeat);`,

  // Migration 009: Audit logging
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);`,

  // Migration 010: Active dispatchers
  `CREATE TABLE IF NOT EXISTS active_dispatchers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    contact_info VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    replaced_by INTEGER REFERENCES users(id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_active_dispatchers_active ON active_dispatchers(ended_at) WHERE ended_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_active_dispatchers_user ON active_dispatchers(user_id);`,

  // Migration 011: Request enhancements
  `ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(20) DEFAULT 'manual';`,
  `ALTER TABLE transporter_status ADD COLUMN IF NOT EXISTS status_explanation TEXT;`,
  `ALTER TABLE transporter_status ADD COLUMN IF NOT EXISTS on_break_since TIMESTAMP WITH TIME ZONE;`,

  // Migration 013: Password reset tokens
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);`,
  `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);`,

  // Migration 014: Offline action queue
  `CREATE TABLE IF NOT EXISTS offline_action_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_offline_at TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_offline_queue_user ON offline_action_queue(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_action_queue(status);`,
];

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('Running migrations...\n');

    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      const preview = sql.substring(0, 60).replace(/\s+/g, ' ');

      try {
        await client.query(sql);
        console.log(`[${i + 1}/${migrations.length}] OK: ${preview}...`);
      } catch (err) {
        console.log(`[${i + 1}/${migrations.length}] SKIP/WARN: ${preview}... (${err.message})`);
      }
    }

    console.log('\nMigrations complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(console.error);
