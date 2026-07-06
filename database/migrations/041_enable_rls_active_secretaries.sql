-- Enable RLS on active_secretaries (added in 034, after the bulk RLS migration 030).
-- Matches the pattern from 030: RLS enabled + zero policies = deny-all for the
-- anon/authenticated PostgREST roles. The app connects as postgres and bypasses RLS.
-- Fixes Supabase linter warning: rls_disabled_in_public / public.active_secretaries.

ALTER TABLE active_secretaries ENABLE ROW LEVEL SECURITY;
