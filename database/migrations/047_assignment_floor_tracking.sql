-- Migration 047: Floor-based auto-assignment toggle + assignee floor tracking
-- auto_assign_floor_first (default true): auto-assign prefers the transporter
-- covering the patient's floor that day (shift floor_assignment, falling back
-- to users.primary_floor); false = pure workload balancing regardless of floor.
-- assignee_floor snapshots the assignee's floor-of-the-day at assignment time
-- so reports can compare pickup floor vs assigned floor.

INSERT INTO system_config (key, value) VALUES
  ('auto_assign_floor_first', 'true')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE transport_requests
  ADD COLUMN IF NOT EXISTS assignee_floor floor_type;
