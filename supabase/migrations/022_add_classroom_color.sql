-- Add color column to classrooms table
ALTER TABLE classrooms
ADD COLUMN IF NOT EXISTS color TEXT;

-- Add comment
COMMENT ON COLUMN classrooms.color IS 'Optional color for the classroom (hex color code)';



