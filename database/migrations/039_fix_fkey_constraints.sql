-- Migration 039: Add missing ON DELETE behaviors to foreign key constraints

-- offline_periods.shift_id → SET NULL when shift is deleted
ALTER TABLE offline_periods DROP CONSTRAINT IF EXISTS offline_periods_shift_id_fkey;
ALTER TABLE offline_periods ADD CONSTRAINT offline_periods_shift_id_fkey
  FOREIGN KEY (shift_id) REFERENCES shift_logs(id) ON DELETE SET NULL;

-- transport_requests.assigned_by → SET NULL when assigning user is deleted
ALTER TABLE transport_requests DROP CONSTRAINT IF EXISTS transport_requests_assigned_by_fkey;
ALTER TABLE transport_requests ADD CONSTRAINT transport_requests_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

-- help_requests.request_id → CASCADE when parent request is deleted
ALTER TABLE help_requests DROP CONSTRAINT IF EXISTS help_requests_request_id_fkey;
ALTER TABLE help_requests ADD CONSTRAINT help_requests_request_id_fkey
  FOREIGN KEY (request_id) REFERENCES transport_requests(id) ON DELETE CASCADE;
