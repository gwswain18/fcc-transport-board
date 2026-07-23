-- Migration 049: Per-job analytics exclusion
-- Managers can exclude an individual job (incident, mis-recorded times) from
-- all analytics calculations without altering the job's actual record. The
-- job stays visible everywhere with an "Excluded" badge; exclusion requires a
-- reason and is audit-logged and reversible.

ALTER TABLE transport_requests
  ADD COLUMN IF NOT EXISTS exclude_from_analytics BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusion_reason TEXT,
  ADD COLUMN IF NOT EXISTS excluded_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ;
