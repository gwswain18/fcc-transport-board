-- Migration 036: Add assigned_by column to track who assigned each transport request
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_transport_requests_assigned_by ON transport_requests(assigned_by);
