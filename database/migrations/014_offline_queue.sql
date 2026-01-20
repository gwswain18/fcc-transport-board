-- Migration 014: Offline action queue
-- Stores actions taken while offline for later sync

CREATE TABLE IF NOT EXISTS offline_action_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_offline_at TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_user ON offline_action_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_action_queue(status);
