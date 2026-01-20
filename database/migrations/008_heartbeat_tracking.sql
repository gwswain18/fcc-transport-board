-- Migration 008: User heartbeat tracking for online/offline detection
-- Tracks last heartbeat timestamp and socket connection

CREATE TABLE IF NOT EXISTS user_heartbeats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    socket_id VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_user_heartbeats_last_heartbeat ON user_heartbeats(last_heartbeat);
