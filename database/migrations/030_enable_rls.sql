-- Enable Row Level Security on all public tables.
-- The app uses a direct postgres superuser connection (bypasses RLS),
-- so this only blocks unauthorized access via Supabase's PostgREST API.
-- No policies are needed: RLS enabled + zero policies = deny all for anon/authenticated roles.

ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transporter_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_dispatchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_time_averages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_time_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_heartbeats ENABLE ROW LEVEL SECURITY;
