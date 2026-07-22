-- Migration 046: Third-party sign-in provider toggles
-- Managers can hide/disable Google and Microsoft sign-in from Settings (e.g.
-- during the pilot). Enforced server-side in oauthLogin/linkOAuthAccount, not
-- just hidden in the UI. Google defaults on (matches current behavior);
-- Microsoft defaults off (its UI has been hidden since March 2026).

INSERT INTO system_config (key, value) VALUES
  ('google_auth_enabled', 'true'),
  ('microsoft_auth_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
