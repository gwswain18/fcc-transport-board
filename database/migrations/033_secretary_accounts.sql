-- Migration 033: Create 8 secretary temp accounts
-- Password: password123 (bcrypt hash with 12 rounds)

INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_temp_account, auth_provider, approval_status)
VALUES
  ('secretary1a@fcc.test', '$2b$12$XeBy/Yy.ErBvapQcUPJvkO3/454z37KLbXGdbf5Et/K3HA4TQ3ANe', 'Secretary', '1A', 'secretary', true, true, 'local', 'approved'),
  ('secretary1b@fcc.test', '$2b$12$XeBy/Yy.ErBvapQcUPJvkO3/454z37KLbXGdbf5Et/K3HA4TQ3ANe', 'Secretary', '1B', 'secretary', true, true, 'local', 'approved'),
  ('secretary4a@fcc.test', '$2b$12$XeBy/Yy.ErBvapQcUPJvkO3/454z37KLbXGdbf5Et/K3HA4TQ3ANe', 'Secretary', '4A', 'secretary', true, true, 'local', 'approved'),
  ('secretary4b@fcc.test', '$2b$12$XeBy/Yy.ErBvapQcUPJvkO3/454z37KLbXGdbf5Et/K3HA4TQ3ANe', 'Secretary', '4B', 'secretary', true, true, 'local', 'approved'),
  ('secretary5a@fcc.test', '$2b$12$XeBy/Yy.ErBvapQcUPJvkO3/454z37KLbXGdbf5Et/K3HA4TQ3ANe', 'Secretary', '5A', 'secretary', true, true, 'local', 'approved'),
  ('secretary5b@fcc.test', '$2b$12$XeBy/Yy.ErBvapQcUPJvkO3/454z37KLbXGdbf5Et/K3HA4TQ3ANe', 'Secretary', '5B', 'secretary', true, true, 'local', 'approved'),
  ('secretary6a@fcc.test', '$2b$12$XeBy/Yy.ErBvapQcUPJvkO3/454z37KLbXGdbf5Et/K3HA4TQ3ANe', 'Secretary', '6A', 'secretary', true, true, 'local', 'approved'),
  ('secretary6b@fcc.test', '$2b$12$XeBy/Yy.ErBvapQcUPJvkO3/454z37KLbXGdbf5Et/K3HA4TQ3ANe', 'Secretary', '6B', 'secretary', true, true, 'local', 'approved')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name;
