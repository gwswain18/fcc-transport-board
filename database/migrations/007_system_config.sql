-- Migration 007: System configuration and cycle time averages
-- Stores rolling averages for cycle times and configurable system settings

CREATE TABLE IF NOT EXISTS cycle_time_averages (
    id SERIAL PRIMARY KEY,
    phase VARCHAR(50) NOT NULL,
    floor floor_type,
    avg_seconds DECIMAL(10,2) NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phase, floor)
);

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default configuration values
INSERT INTO system_config (key, value) VALUES
    ('cycle_time_sample_size', '50'),
    ('cycle_time_threshold_percentage', '30'),
    ('heartbeat_timeout_ms', '120000'),
    ('auto_assign_acceptance_timeout_ms', '120000'),
    ('break_alert_minutes', '30')
ON CONFLICT (key) DO NOTHING;
