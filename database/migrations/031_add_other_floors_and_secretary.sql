-- Add new floor types for Other floors
ALTER TYPE floor_type ADD VALUE '1WC';
ALTER TYPE floor_type ADD VALUE 'HRP';
ALTER TYPE floor_type ADD VALUE 'L&D';
ALTER TYPE floor_type ADD VALUE 'OTF';

-- Add secretary role (between transporter and dispatcher)
ALTER TYPE user_role ADD VALUE 'secretary' BEFORE 'dispatcher';
