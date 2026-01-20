-- Migration 006: Shift tracking for transporters
-- Logs shift start/end times, extensions, and floor assignments

CREATE TABLE IF NOT EXISTS shift_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    shift_start TIMESTAMP WITH TIME ZONE NOT NULL,
    shift_end TIMESTAMP WITH TIME ZONE,
    extension VARCHAR(50),
    floor_assignment floor_type,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shift_logs_user_id ON shift_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_shift_start ON shift_logs(shift_start);
CREATE INDEX IF NOT EXISTS idx_shift_logs_active ON shift_logs(user_id) WHERE shift_end IS NULL;
