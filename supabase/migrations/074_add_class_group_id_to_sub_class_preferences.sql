BEGIN;

-- Add class_group_id to sub_class_preferences if missing
ALTER TABLE sub_class_preferences
  ADD COLUMN IF NOT EXISTS class_group_id UUID;

-- Optional: add FK to class_groups (safe if table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sub_class_preferences_class_group_id_fkey'
  ) THEN
    ALTER TABLE sub_class_preferences
      ADD CONSTRAINT sub_class_preferences_class_group_id_fkey
      FOREIGN KEY (class_group_id) REFERENCES class_groups(id);
  END IF;
END $$;

-- Note: If legacy class_id exists and you have a mapping, backfill here.
-- This is left intentionally blank because prod currently has neither class_id nor class_group_id.

COMMIT;
