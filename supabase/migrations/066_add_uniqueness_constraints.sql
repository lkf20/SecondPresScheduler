BEGIN;

-- 1) Preflight duplicate checks (fail fast)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT school_id, classroom_id, class_group_id, COUNT(*) AS c
      FROM classroom_allowed_classes
      GROUP BY school_id, classroom_id, class_group_id
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION
      'Duplicate rows found in classroom_allowed_classes (school_id, classroom_id, class_group_id). Clean these before adding UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT school_id, staff_id, classroom_id, COUNT(*) AS c
      FROM classroom_preferences
      GROUP BY school_id, staff_id, classroom_id
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION
      'Duplicate rows found in classroom_preferences (school_id, staff_id, classroom_id). Clean these before adding UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT school_id, class_group_id, day_of_week_id, time_slot_id, COUNT(*) AS c
      FROM enrollments
      GROUP BY school_id, class_group_id, day_of_week_id, time_slot_id
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION
      'Duplicate rows found in enrollments (school_id, class_group_id, day_of_week_id, time_slot_id). Clean these before adding UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT staff_id, qualification_id, COUNT(*) AS c
      FROM staff_qualifications
      GROUP BY staff_id, qualification_id
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION
      'Duplicate rows found in staff_qualifications (staff_id, qualification_id). Clean these before adding UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT school_id, code, COUNT(*) AS c
      FROM staff_role_types
      GROUP BY school_id, code
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION
      'Duplicate rows found in staff_role_types (school_id, code). Clean these before adding UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT school_id, name, COUNT(*) AS c
      FROM qualification_definitions
      GROUP BY school_id, name
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION
      'Duplicate rows found in qualification_definitions (school_id, name). Clean these before adding UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT school_id, classroom_id, day_of_week_id, time_slot_id, COUNT(*) AS c
      FROM schedule_cells
      GROUP BY school_id, classroom_id, day_of_week_id, time_slot_id
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION
      'Duplicate rows found in schedule_cells (school_id, classroom_id, day_of_week_id, time_slot_id). Clean these before adding UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT schedule_cell_id, class_group_id, COUNT(*) AS c
      FROM schedule_cell_class_groups
      GROUP BY schedule_cell_id, class_group_id
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION
      'Duplicate rows found in schedule_cell_class_groups (schedule_cell_id, class_group_id). Clean these before adding UNIQUE constraint.';
  END IF;
END $$;

-- 2) Add UNIQUE constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classroom_allowed_classes_unique_school_classroom_class_group'
  ) THEN
    ALTER TABLE classroom_allowed_classes
      ADD CONSTRAINT classroom_allowed_classes_unique_school_classroom_class_group
      UNIQUE (school_id, classroom_id, class_group_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classroom_preferences_unique_school_staff_classroom'
  ) THEN
    ALTER TABLE classroom_preferences
      ADD CONSTRAINT classroom_preferences_unique_school_staff_classroom
      UNIQUE (school_id, staff_id, classroom_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_unique_school_class_group_day_time'
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_unique_school_class_group_day_time
      UNIQUE (school_id, class_group_id, day_of_week_id, time_slot_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_qualifications_unique_staff_qualification'
  ) THEN
    ALTER TABLE staff_qualifications
      ADD CONSTRAINT staff_qualifications_unique_staff_qualification
      UNIQUE (staff_id, qualification_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_role_types_unique_school_code'
  ) THEN
    ALTER TABLE staff_role_types
      ADD CONSTRAINT staff_role_types_unique_school_code
      UNIQUE (school_id, code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qualification_definitions_unique_school_name'
  ) THEN
    ALTER TABLE qualification_definitions
      ADD CONSTRAINT qualification_definitions_unique_school_name
      UNIQUE (school_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schedule_cells_unique_school_classroom_day_time'
  ) THEN
    ALTER TABLE schedule_cells
      ADD CONSTRAINT schedule_cells_unique_school_classroom_day_time
      UNIQUE (school_id, classroom_id, day_of_week_id, time_slot_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schedule_cell_class_groups_unique_cell_class_group'
  ) THEN
    ALTER TABLE schedule_cell_class_groups
      ADD CONSTRAINT schedule_cell_class_groups_unique_cell_class_group
      UNIQUE (schedule_cell_id, class_group_id);
  END IF;
END $$;

COMMIT;
