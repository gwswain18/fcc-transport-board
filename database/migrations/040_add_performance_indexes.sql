-- Migration 040: Add indexes on hot query paths for performance

CREATE INDEX IF NOT EXISTS idx_heartbeats_last ON user_heartbeats(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_requests_status_assigned ON transport_requests(status, assigned_at);
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON transport_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_dispatchers_ended_primary ON active_dispatchers(ended_at, is_primary);
CREATE INDEX IF NOT EXISTS idx_offline_periods_online ON offline_periods(online_at);
CREATE INDEX IF NOT EXISTS idx_secretaries_ended ON active_secretaries(ended_at);
