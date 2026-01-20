-- 016: Dispatcher Break Enhancements
-- Adds on_break tracking, break timing, and free text relief info for dispatchers

ALTER TABLE active_dispatchers
ADD COLUMN IF NOT EXISTS on_break BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS break_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS relief_info TEXT;

-- Add index for break queries
CREATE INDEX IF NOT EXISTS idx_active_dispatchers_on_break
ON active_dispatchers(on_break)
WHERE ended_at IS NULL;

-- Comment for clarity
COMMENT ON COLUMN active_dispatchers.on_break IS 'Whether dispatcher is currently on break';
COMMENT ON COLUMN active_dispatchers.break_start IS 'When the break started';
COMMENT ON COLUMN active_dispatchers.relief_info IS 'Free text describing who is covering (when not another dispatcher)';
