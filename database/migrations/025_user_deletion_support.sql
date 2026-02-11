-- Make transport_requests.created_by nullable and SET NULL on delete
ALTER TABLE transport_requests ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE transport_requests DROP CONSTRAINT IF EXISTS transport_requests_created_by_fkey;
ALTER TABLE transport_requests ADD CONSTRAINT transport_requests_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- SET NULL on assigned_to deletion
ALTER TABLE transport_requests DROP CONSTRAINT IF EXISTS transport_requests_assigned_to_fkey;
ALTER TABLE transport_requests ADD CONSTRAINT transport_requests_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- CASCADE delete for shift_logs
ALTER TABLE shift_logs DROP CONSTRAINT IF EXISTS shift_logs_user_id_fkey;
ALTER TABLE shift_logs ADD CONSTRAINT shift_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- CASCADE delete for user_heartbeats
ALTER TABLE user_heartbeats DROP CONSTRAINT IF EXISTS user_heartbeats_user_id_fkey;
ALTER TABLE user_heartbeats ADD CONSTRAINT user_heartbeats_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- CASCADE delete for password_reset_tokens
ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_user_id_fkey;
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- SET NULL on audit_logs.user_id deletion
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- SET NULL on help_requests references
ALTER TABLE help_requests DROP CONSTRAINT IF EXISTS help_requests_user_id_fkey;
ALTER TABLE help_requests ADD CONSTRAINT help_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE help_requests ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE help_requests DROP CONSTRAINT IF EXISTS help_requests_resolved_by_fkey;
ALTER TABLE help_requests ADD CONSTRAINT help_requests_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

-- CASCADE delete for transporter_status
ALTER TABLE transporter_status DROP CONSTRAINT IF EXISTS transporter_status_user_id_fkey;
ALTER TABLE transporter_status ADD CONSTRAINT transporter_status_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
