-- Migration 011: Transport request and status enhancements
-- Adds assignment method tracking and status explanation support

ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(20) DEFAULT 'manual';

ALTER TABLE transporter_status ADD COLUMN IF NOT EXISTS status_explanation TEXT;
ALTER TABLE transporter_status ADD COLUMN IF NOT EXISTS on_break_since TIMESTAMP WITH TIME ZONE;
