-- Migration 035: Add lockout_until column for session-end lockout
ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP WITH TIME ZONE;
