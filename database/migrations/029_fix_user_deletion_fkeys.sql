-- Fix missing ON DELETE constraints that block permanent user deletion
-- Tables missed in migration 025_user_deletion_support.sql

-- status_history: preserve history, null out the user reference
ALTER TABLE status_history ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE status_history DROP CONSTRAINT IF EXISTS status_history_user_id_fkey;
ALTER TABLE status_history ADD CONSTRAINT status_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- active_dispatchers: cascade delete session records
ALTER TABLE active_dispatchers DROP CONSTRAINT IF EXISTS active_dispatchers_user_id_fkey;
ALTER TABLE active_dispatchers ADD CONSTRAINT active_dispatchers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- active_dispatchers.replaced_by: null out the reference
ALTER TABLE active_dispatchers DROP CONSTRAINT IF EXISTS active_dispatchers_replaced_by_fkey;
ALTER TABLE active_dispatchers ADD CONSTRAINT active_dispatchers_replaced_by_fkey
    FOREIGN KEY (replaced_by) REFERENCES users(id) ON DELETE SET NULL;

-- cycle_time_dismissals: preserve audit trail, null user
ALTER TABLE cycle_time_dismissals DROP CONSTRAINT IF EXISTS cycle_time_dismissals_dismissed_by_fkey;
ALTER TABLE cycle_time_dismissals ADD CONSTRAINT cycle_time_dismissals_dismissed_by_fkey
    FOREIGN KEY (dismissed_by) REFERENCES users(id) ON DELETE SET NULL;

-- offline_action_queue: cascade delete transient queue data
ALTER TABLE offline_action_queue DROP CONSTRAINT IF EXISTS offline_action_queue_user_id_fkey;
ALTER TABLE offline_action_queue ADD CONSTRAINT offline_action_queue_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
