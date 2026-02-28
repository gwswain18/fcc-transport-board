-- Add new floor types for Other floors (IF NOT EXISTS for idempotency)
ALTER TYPE floor_type ADD VALUE IF NOT EXISTS '1WC';
ALTER TYPE floor_type ADD VALUE IF NOT EXISTS 'HRP';
ALTER TYPE floor_type ADD VALUE IF NOT EXISTS 'L&D';
ALTER TYPE floor_type ADD VALUE IF NOT EXISTS 'OTF';

-- Add secretary role (between transporter and dispatcher)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary' BEFORE 'dispatcher';
