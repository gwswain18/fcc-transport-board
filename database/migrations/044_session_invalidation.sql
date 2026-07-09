-- Migration 044: Durable session revocation
-- Lets a manager (or the user) invalidate all outstanding JWTs for an account.
-- A JWT issued before this timestamp is rejected by the auth middleware and the
-- socket handshake, so ending a session takes effect immediately rather than
-- surviving until the 12h token expiry.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_invalidated_at TIMESTAMP WITH TIME ZONE;
