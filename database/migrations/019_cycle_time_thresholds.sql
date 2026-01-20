-- Migration 019: Cycle Time Thresholds and Dismissals
-- Adds configurable phase thresholds and tracking for alert dismissals

-- Insert default phase threshold configurations
INSERT INTO system_config (key, value) VALUES
('phase_threshold_response', '{"minutes": 2, "enabled": true}'),
('phase_threshold_acceptance', '{"minutes": 2, "enabled": true}'),
('phase_threshold_pickup', '{"minutes": 5, "enabled": true}'),
('phase_threshold_en_route', '{"minutes": 3, "enabled": true}'),
('phase_threshold_transport', '{"minutes": 5, "enabled": true}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create table to track alert dismissals with reasons
CREATE TABLE IF NOT EXISTS cycle_time_dismissals (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES transport_requests(id) ON DELETE CASCADE,
  phase VARCHAR(50) NOT NULL,
  dismissed_by INTEGER REFERENCES users(id),
  reason TEXT NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying dismissals by request
CREATE INDEX IF NOT EXISTS idx_cycle_time_dismissals_request
ON cycle_time_dismissals(request_id);

-- Index for querying dismissals by user
CREATE INDEX IF NOT EXISTS idx_cycle_time_dismissals_user
ON cycle_time_dismissals(dismissed_by);

-- Comments
COMMENT ON TABLE cycle_time_dismissals IS 'Tracks when and why cycle time alerts are dismissed';
COMMENT ON COLUMN cycle_time_dismissals.phase IS 'The phase that triggered the alert (response, acceptance, pickup, en_route, transport)';
COMMENT ON COLUMN cycle_time_dismissals.reason IS 'User-provided reason for dismissing the alert';
