-- Migration 018: Update temporary DCT accounts
-- Updates existing 3 accounts and adds 2 more for floors 5 and 6
-- Accounts: 1A, 1B (for FCC1), 4, 5, 6 (for respective floors)
-- Password: 'temp123' (bcrypt hash)

-- First, update existing accounts to new naming scheme
UPDATE users SET
  email = 'temp.dct1a@fcc-transport.local',
  first_name = 'Temp DCT',
  last_name = '1A',
  primary_floor = 'FCC1',
  password_hash = '$2b$10$YqjLgvqHdVb.kEwBBKQvKObM1WqvKEFvRDqH3jDMKGKBGhK3Y.hJa'
WHERE email = 'temp.dct1@fcc-transport.local';

UPDATE users SET
  email = 'temp.dct1b@fcc-transport.local',
  first_name = 'Temp DCT',
  last_name = '1B',
  primary_floor = 'FCC1',
  password_hash = '$2b$10$YqjLgvqHdVb.kEwBBKQvKObM1WqvKEFvRDqH3jDMKGKBGhK3Y.hJa'
WHERE email = 'temp.dct2@fcc-transport.local';

UPDATE users SET
  email = 'temp.dct4@fcc-transport.local',
  first_name = 'Temp DCT',
  last_name = '4',
  primary_floor = 'FCC4',
  password_hash = '$2b$10$YqjLgvqHdVb.kEwBBKQvKObM1WqvKEFvRDqH3jDMKGKBGhK3Y.hJa'
WHERE email = 'temp.dct3@fcc-transport.local';

-- Add new accounts for floors 5 and 6
-- Password hash is for 'temp123' using bcrypt with 10 rounds
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_temp_account, primary_floor)
VALUES
    ('temp.dct5@fcc-transport.local', '$2b$10$YqjLgvqHdVb.kEwBBKQvKObM1WqvKEFvRDqH3jDMKGKBGhK3Y.hJa', 'Temp DCT', '5', 'transporter', true, true, 'FCC5'),
    ('temp.dct6@fcc-transport.local', '$2b$10$YqjLgvqHdVb.kEwBBKQvKObM1WqvKEFvRDqH3jDMKGKBGhK3Y.hJa', 'Temp DCT', '6', 'transporter', true, true, 'FCC6')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    primary_floor = EXCLUDED.primary_floor;

-- Note: The password hash '$2b$10$YqjLgvqHdVb.kEwBBKQvKObM1WqvKEFvRDqH3jDMKGKBGhK3Y.hJa'
-- corresponds to 'temp123' hashed with bcrypt, 10 salt rounds.
-- This should be regenerated in production using: await bcrypt.hash('temp123', 10)
