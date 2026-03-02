-- Migration 038: Reset secretary temp account passwords to a stronger default
-- Old password was 'password123' which is a security risk on an internet-facing app
-- New password: FccSecretary!2025 (bcrypt hash with 12 rounds)

UPDATE users
SET password_hash = '$2b$12$C43cNf.liqNJyswEJ8DvyOFh/l.uVGCKHMDCU7Pqy2GIZDsVS5A5O'
WHERE is_temp_account = true
  AND role = 'secretary'
  AND email LIKE '%@fcc.test';
