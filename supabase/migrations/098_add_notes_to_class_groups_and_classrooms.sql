-- Add optional notes to class_groups and classrooms (Settings)
ALTER TABLE class_groups
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN class_groups.notes IS 'Optional notes for the class group (e.g. reminders, special requirements).';
COMMENT ON COLUMN classrooms.notes IS 'Optional notes for the classroom (e.g. location, equipment).';
