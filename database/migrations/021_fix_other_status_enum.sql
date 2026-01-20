-- Fix: Rename 'off_unit' to 'other' in the transporter_status_type enum
-- The PostgreSQL enum has 'off_unit' but all application code references 'other'

ALTER TYPE transporter_status_type RENAME VALUE 'off_unit' TO 'other';
