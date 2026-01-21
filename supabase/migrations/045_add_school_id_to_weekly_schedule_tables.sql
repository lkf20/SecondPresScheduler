-- Migration 045: Add school_id to Weekly Schedule related tables for multi-tenancy support
-- This migration adds school_id columns to tables that need to be filtered by school

-- Step 1: Get the default school ID (same one used in migration 044)
DO $$
DECLARE
  default_school_id UUID;
BEGIN
  SELECT id INTO default_school_id
  FROM schools
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  IF default_school_id IS NULL THEN
    INSERT INTO schools (id, name)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Second Presbyterian Weekday School')
    RETURNING id INTO default_school_id;
  END IF;

  -- Step 2: Add school_id to classrooms
  ALTER TABLE classrooms
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 3: Add school_id to time_slots
  ALTER TABLE time_slots
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 4: Add school_id to class_groups
  ALTER TABLE class_groups
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 5: Add school_id to teacher_schedules
  ALTER TABLE teacher_schedules
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 6: Add school_id to staffing_rules
  ALTER TABLE staffing_rules
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 7: Add school_id to schedule_cells
  ALTER TABLE schedule_cells
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 8: Add school_id to schedule_settings
  ALTER TABLE schedule_settings
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 9: Backfill existing data with default school_id
  UPDATE classrooms
  SET school_id = default_school_id
  WHERE school_id IS NULL;

  UPDATE time_slots
  SET school_id = default_school_id
  WHERE school_id IS NULL;

  UPDATE class_groups
  SET school_id = default_school_id
  WHERE school_id IS NULL;

  UPDATE teacher_schedules
  SET school_id = default_school_id
  WHERE school_id IS NULL;

  UPDATE staffing_rules
  SET school_id = default_school_id
  WHERE school_id IS NULL;

  UPDATE schedule_cells
  SET school_id = default_school_id
  WHERE school_id IS NULL;

  UPDATE schedule_settings
  SET school_id = default_school_id
  WHERE school_id IS NULL;

  -- Step 10: Make school_id NOT NULL after backfilling
  ALTER TABLE classrooms
    ALTER COLUMN school_id SET NOT NULL;

  ALTER TABLE time_slots
    ALTER COLUMN school_id SET NOT NULL;

  ALTER TABLE class_groups
    ALTER COLUMN school_id SET NOT NULL;

  ALTER TABLE teacher_schedules
    ALTER COLUMN school_id SET NOT NULL;

  ALTER TABLE staffing_rules
    ALTER COLUMN school_id SET NOT NULL;

  ALTER TABLE schedule_cells
    ALTER COLUMN school_id SET NOT NULL;

  ALTER TABLE schedule_settings
    ALTER COLUMN school_id SET NOT NULL;

  -- Step 11: Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_classrooms_school_id ON classrooms(school_id);
  CREATE INDEX IF NOT EXISTS idx_time_slots_school_id ON time_slots(school_id);
  CREATE INDEX IF NOT EXISTS idx_class_groups_school_id ON class_groups(school_id);
  CREATE INDEX IF NOT EXISTS idx_teacher_schedules_school_id ON teacher_schedules(school_id);
  CREATE INDEX IF NOT EXISTS idx_staffing_rules_school_id ON staffing_rules(school_id);
  CREATE INDEX IF NOT EXISTS idx_schedule_cells_school_id ON schedule_cells(school_id);
  CREATE INDEX IF NOT EXISTS idx_schedule_settings_school_id ON schedule_settings(school_id);

  RAISE NOTICE 'Added school_id columns and backfilled with default school: %', default_school_id;
END $$;

-- Step 12: Update unique constraints to include school_id where appropriate
-- Note: Some tables have UNIQUE constraints that should now be scoped to school_id
-- (Moved outside the DO block to avoid nesting issues)

-- For classrooms: name should be unique per school, not globally
-- Drop the old unique constraint if it exists (may be a constraint or index)
DO $$
BEGIN
  -- Try to drop as a constraint first
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classrooms_name_key') THEN
    ALTER TABLE classrooms DROP CONSTRAINT IF EXISTS classrooms_name_key;
  END IF;
  -- Drop as index if it exists
  DROP INDEX IF EXISTS classrooms_name_key;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS classrooms_name_school_id_unique ON classrooms(name, school_id);

-- For time_slots: code should be unique per school
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_slots_code_key') THEN
    ALTER TABLE time_slots DROP CONSTRAINT IF EXISTS time_slots_code_key;
  END IF;
  DROP INDEX IF EXISTS time_slots_code_key;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS time_slots_code_school_id_unique ON time_slots(code, school_id);

-- For class_groups: name should be unique per school
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_groups_name_key') THEN
    ALTER TABLE class_groups DROP CONSTRAINT IF EXISTS class_groups_name_key;
  END IF;
  DROP INDEX IF EXISTS class_groups_name_key;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS class_groups_name_school_id_unique ON class_groups(name, school_id);

-- For schedule_settings: should be one per school (update the single row constraint)
DROP INDEX IF EXISTS schedule_settings_single_row;
CREATE UNIQUE INDEX IF NOT EXISTS schedule_settings_school_id_unique ON schedule_settings(school_id);
