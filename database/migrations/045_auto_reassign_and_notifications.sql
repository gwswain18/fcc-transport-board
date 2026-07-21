-- Migration 045: Auto-reassign config + persistent user notifications
-- Seeds the auto-reassign settings (enabled by default, 2-minute timeout —
-- preserves and extends the previous auto-only timeout behavior) and adds the
-- user_notifications table used to tell a transporter they missed a job the
-- next time they are active, even if they were offline when it happened.

INSERT INTO system_config (key, value) VALUES
  ('auto_reassign_enabled', 'true'),
  ('auto_reassign_timeout_minutes', '2')
ON CONFLICT (key) DO NOTHING;

-- The timeout scan no longer filters on assignment_method, so it needs an
-- index without it (043's idx_requests_method_status_assigned leads with
-- assignment_method and cannot serve the widened query).
CREATE INDEX IF NOT EXISTS idx_requests_status_assigned_at
  ON transport_requests (status, assigned_at);

-- Persistent per-user notifications. Currently only type 'missed_job';
-- extensible via type + payload. Rows double as the durable record of who
-- missed a request (exclusion list for re-selection).
CREATE TABLE IF NOT EXISTS user_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'missed_job',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_pending
  ON user_notifications (user_id) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_type_created
  ON user_notifications (type, created_at);

-- RLS enabled + zero policies = deny-all for PostgREST roles (matches 030/041).
-- The app connects as postgres and bypasses RLS.
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_notifications IS 'Durable server-to-user notifications delivered on socket connect; missed_job rows also feed the auto-reassign exclusion list';
