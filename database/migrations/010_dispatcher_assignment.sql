-- Migration 010: Active dispatcher tracking
-- Tracks primary and assistant dispatchers with contact info

CREATE TABLE IF NOT EXISTS active_dispatchers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    contact_info VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    replaced_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_active_dispatchers_active ON active_dispatchers(ended_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_active_dispatchers_user ON active_dispatchers(user_id);
