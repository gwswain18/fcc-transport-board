-- Migration: Alert Settings Configuration
-- Adds system config for alert toggles and dismissal explanation requirement

INSERT INTO system_config (key, value) VALUES
('alert_settings', '{
  "master_enabled": true,
  "alerts": {
    "pending_timeout": true,
    "stat_timeout": true,
    "acceptance_timeout": true,
    "break_alert": true,
    "offline_alert": true,
    "cycle_time_alert": true
  },
  "require_explanation_on_dismiss": true
}')
ON CONFLICT (key) DO NOTHING;
