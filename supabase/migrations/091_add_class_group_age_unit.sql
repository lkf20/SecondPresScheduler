ALTER TABLE class_groups
ADD COLUMN IF NOT EXISTS age_unit TEXT;

UPDATE class_groups
SET age_unit = 'years'
WHERE age_unit IS NULL;

ALTER TABLE class_groups
ALTER COLUMN age_unit SET DEFAULT 'years',
ALTER COLUMN age_unit SET NOT NULL;

ALTER TABLE class_groups
DROP CONSTRAINT IF EXISTS class_groups_age_unit_check;

ALTER TABLE class_groups
ADD CONSTRAINT class_groups_age_unit_check
CHECK (age_unit IN ('months', 'years'));
