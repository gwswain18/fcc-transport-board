-- Migration 005: Enhance users table with additional fields
-- Adds primary_floor, phone_number, include_in_analytics, and is_temp_account

ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_floor floor_type;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS include_in_analytics BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temp_account BOOLEAN NOT NULL DEFAULT false;

-- Index for quick lookups by primary floor
CREATE INDEX IF NOT EXISTS idx_users_primary_floor ON users(primary_floor);
