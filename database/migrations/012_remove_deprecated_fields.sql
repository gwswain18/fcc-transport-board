-- Migration 012: Remove deprecated fields from transport_requests
-- IMPORTANT: Run AFTER verifying no application dependencies

-- Remove patient_initials (PHI concern)
ALTER TABLE transport_requests DROP COLUMN IF EXISTS patient_initials;

-- Remove special_needs and special_needs_notes (no longer used)
ALTER TABLE transport_requests DROP COLUMN IF EXISTS special_needs;
ALTER TABLE transport_requests DROP COLUMN IF EXISTS special_needs_notes;
