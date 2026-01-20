-- Migration 015: Seed temporary DCT accounts
-- Creates 3 permanent placeholder accounts for temporary transporters
-- Password hash is for 'TempDCT2024!' - should be changed via application

INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_temp_account)
VALUES
    ('temp.dct1@fcc-transport.local', '$2b$10$placeholder.hash.will.be.set.by.app', 'Temp', 'DCT 1', 'transporter', true, true),
    ('temp.dct2@fcc-transport.local', '$2b$10$placeholder.hash.will.be.set.by.app', 'Temp', 'DCT 2', 'transporter', true, true),
    ('temp.dct3@fcc-transport.local', '$2b$10$placeholder.hash.will.be.set.by.app', 'Temp', 'DCT 3', 'transporter', true, true)
ON CONFLICT (email) DO NOTHING;
