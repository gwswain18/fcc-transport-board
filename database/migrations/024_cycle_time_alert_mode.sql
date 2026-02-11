-- Add cycle time alert mode config (rolling_average vs manual_threshold)
INSERT INTO system_config (key, value, updated_at)
VALUES ('cycle_time_alert_mode', '"rolling_average"', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
