-- Add age and ratio fields to classes table
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS min_age INTEGER,
ADD COLUMN IF NOT EXISTS max_age INTEGER,
ADD COLUMN IF NOT EXISTS required_ratio INTEGER NOT NULL DEFAULT 8,
ADD COLUMN IF NOT EXISTS preferred_ratio INTEGER;

-- Update existing classes to have a default required_ratio if NULL
UPDATE classes
SET required_ratio = 8
WHERE required_ratio IS NULL;

