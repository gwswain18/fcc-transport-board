-- Clear operational data for 7 transporters while keeping user accounts intact.
-- Run the verification SELECT first to confirm all 7 users are found.

-- ============================================================
-- STEP 1: Verify all 7 users exist
-- ============================================================
SELECT id, first_name, last_name
FROM users
WHERE (first_name, last_name) IN (
  ('Helen',     'Champion'),
  ('Cherri',    'Holden'),
  ('Tiffany',   'Jacob'),
  ('Oliver',    'Madison'),
  ('Roderick',  'Richardson'),
  ('Daishawn',  'Rock'),
  ('Lasha',     'Ruffner')
);
-- Expect exactly 7 rows. If fewer, stop and investigate before proceeding.

-- ============================================================
-- STEP 2: Clear data (run after confirming Step 1)
-- ============================================================
BEGIN;

-- 1. offline_periods (FK -> shift_logs, no CASCADE)
DELETE FROM offline_periods
WHERE user_id IN (
  SELECT id FROM users WHERE (first_name, last_name) IN (
    ('Helen','Champion'),('Cherri','Holden'),('Tiffany','Jacob'),
    ('Oliver','Madison'),('Roderick','Richardson'),('Daishawn','Rock'),('Lasha','Ruffner')
  )
);

-- 2. transport_requests (cascades to request_delays via ON DELETE CASCADE)
DELETE FROM transport_requests
WHERE assigned_to IN (
  SELECT id FROM users WHERE (first_name, last_name) IN (
    ('Helen','Champion'),('Cherri','Holden'),('Tiffany','Jacob'),
    ('Oliver','Madison'),('Roderick','Richardson'),('Daishawn','Rock'),('Lasha','Ruffner')
  )
);

-- 3. shift_logs (now safe — offline_periods already removed)
DELETE FROM shift_logs
WHERE user_id IN (
  SELECT id FROM users WHERE (first_name, last_name) IN (
    ('Helen','Champion'),('Cherri','Holden'),('Tiffany','Jacob'),
    ('Oliver','Madison'),('Roderick','Richardson'),('Daishawn','Rock'),('Lasha','Ruffner')
  )
);

-- 4. user_heartbeats
DELETE FROM user_heartbeats
WHERE user_id IN (
  SELECT id FROM users WHERE (first_name, last_name) IN (
    ('Helen','Champion'),('Cherri','Holden'),('Tiffany','Jacob'),
    ('Oliver','Madison'),('Roderick','Richardson'),('Daishawn','Rock'),('Lasha','Ruffner')
  )
);

-- 5. offline_action_queue
DELETE FROM offline_action_queue
WHERE user_id IN (
  SELECT id FROM users WHERE (first_name, last_name) IN (
    ('Helen','Champion'),('Cherri','Holden'),('Tiffany','Jacob'),
    ('Oliver','Madison'),('Roderick','Richardson'),('Daishawn','Rock'),('Lasha','Ruffner')
  )
);

-- 6. audit_logs
DELETE FROM audit_logs
WHERE user_id IN (
  SELECT id FROM users WHERE (first_name, last_name) IN (
    ('Helen','Champion'),('Cherri','Holden'),('Tiffany','Jacob'),
    ('Oliver','Madison'),('Roderick','Richardson'),('Daishawn','Rock'),('Lasha','Ruffner')
  )
);

-- 7. Reset transporter_status
UPDATE transporter_status
SET status = 'available',
    went_offline_at = NULL,
    on_break_since = NULL,
    status_explanation = NULL
WHERE user_id IN (
  SELECT id FROM users WHERE (first_name, last_name) IN (
    ('Helen','Champion'),('Cherri','Holden'),('Tiffany','Jacob'),
    ('Oliver','Madison'),('Roderick','Richardson'),('Daishawn','Rock'),('Lasha','Ruffner')
  )
);

COMMIT;
