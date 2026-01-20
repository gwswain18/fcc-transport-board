-- 017: PCT (Patient Care Technician) Assignment
-- Allows requests to be transferred to PCT with auto-close functionality
-- Note: The 'transferred_to_pct' enum value is added in 016b_add_pct_status.sql

-- Add PCT-related columns to transport_requests
ALTER TABLE transport_requests
ADD COLUMN IF NOT EXISTS pct_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pct_auto_close_at TIMESTAMP WITH TIME ZONE;

-- Add PCT auto-close time configuration
INSERT INTO system_config (key, value) VALUES
('pct_auto_close_minutes', '15')
ON CONFLICT (key) DO NOTHING;

-- Index for finding PCT requests that need auto-close
CREATE INDEX IF NOT EXISTS idx_transport_requests_pct_auto_close
ON transport_requests(pct_auto_close_at)
WHERE status = 'transferred_to_pct' AND pct_auto_close_at IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN transport_requests.pct_assigned_at IS 'When the request was transferred to PCT';
COMMENT ON COLUMN transport_requests.pct_auto_close_at IS 'When the request should be auto-closed';
