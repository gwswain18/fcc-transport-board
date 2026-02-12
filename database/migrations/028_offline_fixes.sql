-- Fix: Prevent duplicate open offline_periods per user
-- Only one row per user can have online_at IS NULL at a time
DROP INDEX IF EXISTS idx_offline_periods_open;
CREATE UNIQUE INDEX idx_offline_periods_user_open
  ON offline_periods(user_id) WHERE online_at IS NULL;
