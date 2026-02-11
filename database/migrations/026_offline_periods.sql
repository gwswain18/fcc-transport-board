-- Offline periods tracking table
CREATE TABLE IF NOT EXISTS offline_periods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES shift_logs(id),
    offline_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    online_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER
);

CREATE INDEX idx_offline_periods_user_id ON offline_periods(user_id);
CREATE INDEX idx_offline_periods_open ON offline_periods(user_id) WHERE online_at IS NULL;

-- Add went_offline_at column to transporter_status
ALTER TABLE transporter_status ADD COLUMN IF NOT EXISTS went_offline_at TIMESTAMP WITH TIME ZONE;
