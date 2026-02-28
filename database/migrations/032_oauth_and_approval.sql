-- Migration 032: OAuth support and user approval workflow
-- Adds auth_provider, provider_id, and approval_status to users table

-- Allow OAuth-only users (no password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Auth provider tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved';

-- Constraints
ALTER TABLE users ADD CONSTRAINT chk_auth_provider CHECK (auth_provider IN ('local', 'google', 'microsoft'));
ALTER TABLE users ADD CONSTRAINT chk_approval_status CHECK (approval_status IN ('approved', 'pending', 'rejected'));

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_identity
  ON users(auth_provider, provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
