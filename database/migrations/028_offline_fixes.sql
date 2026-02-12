-- Fix: Prevent duplicate open offline_periods per user
-- Only one row per user can have online_at IS NULL at a time

-- First, close all but the most recent open offline_period per user
UPDATE offline_periods op
SET online_at = CURRENT_TIMESTAMP,
    duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - offline_at))::int
WHERE online_at IS NULL
  AND id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM offline_periods
    WHERE online_at IS NULL
    ORDER BY user_id, offline_at DESC
  );

DROP INDEX IF EXISTS idx_offline_periods_open;
CREATE UNIQUE INDEX idx_offline_periods_user_open
  ON offline_periods(user_id) WHERE online_at IS NULL;
