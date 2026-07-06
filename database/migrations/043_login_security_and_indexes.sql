-- Migration 043: Login security columns + missing hot-path indexes

-- Track consecutive failed logins for automatic account lockout
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;

-- Stamp password changes so tokens issued before a reset can be invalidated
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- Hot-path indexes missing from earlier migrations
-- claimRequest / socket "active job" checks: WHERE assigned_to = $1 AND status NOT IN (...)
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to_status ON transport_requests(assigned_to, status);
-- auto-assign timeout scan: WHERE status = 'assigned' AND assignment_method = 'auto' AND assigned_at < $1
CREATE INDEX IF NOT EXISTS idx_requests_method_status_assigned ON transport_requests(assignment_method, status, assigned_at);
-- getRequests date filters and ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON transport_requests(created_at);
-- last-modifier lookup in getRequests
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_timestamp ON audit_logs(entity_type, entity_id, timestamp DESC);
-- FK index parity with the other user_id foreign keys
CREATE INDEX IF NOT EXISTS idx_status_history_user_id ON status_history(user_id);
