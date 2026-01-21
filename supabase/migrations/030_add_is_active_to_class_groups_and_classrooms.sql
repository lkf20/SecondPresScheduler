-- Add is_active column to class_groups
ALTER TABLE class_groups
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_class_groups_is_active ON class_groups(is_active);

-- Update existing records to be active
UPDATE class_groups SET is_active = TRUE WHERE is_active IS NULL;

-- Add is_active column to classrooms
ALTER TABLE classrooms
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_classrooms_is_active ON classrooms(is_active);

-- Update existing records to be active
UPDATE classrooms SET is_active = TRUE WHERE is_active IS NULL;

-- Add comments
COMMENT ON COLUMN class_groups.is_active IS 'When false, the class group is inactive and will not appear in dropdowns, but historical data is preserved.';
COMMENT ON COLUMN classrooms.is_active IS 'When false, the classroom is inactive and will not appear in dropdowns, but historical data is preserved.';



