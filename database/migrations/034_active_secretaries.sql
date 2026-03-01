-- Migration 034: Create active_secretaries table for per-session identity tracking
-- Mirrors the active_dispatchers pattern

CREATE TABLE IF NOT EXISTS active_secretaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_first_name VARCHAR(100) NOT NULL,
    session_last_name VARCHAR(100) NOT NULL,
    phone_extension VARCHAR(20),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_active_secretaries_active ON active_secretaries (user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_active_secretaries_user ON active_secretaries (user_id);
