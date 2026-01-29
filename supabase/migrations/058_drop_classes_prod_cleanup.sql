BEGIN;

-- 1) Drop legacy foreign keys that still point at class_id
ALTER TABLE teacher_schedules
  DROP CONSTRAINT IF EXISTS teacher_schedules_class_id_fkey;

ALTER TABLE staffing_rules
  DROP CONSTRAINT IF EXISTS staffing_rules_class_id_fkey;

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_class_id_fkey;

ALTER TABLE class_classroom_mappings
  DROP CONSTRAINT IF EXISTS class_classroom_mappings_class_id_fkey;

ALTER TABLE classroom_allowed_classes
  DROP CONSTRAINT IF EXISTS classroom_allowed_classes_class_id_fkey;

ALTER TABLE sub_class_preferences
  DROP CONSTRAINT IF EXISTS sub_class_preferences_class_id_fkey;

-- 2) Drop legacy indexes that were built on class_id
DROP INDEX IF EXISTS idx_teacher_schedules_class;
DROP INDEX IF EXISTS idx_class_classroom_mappings_class;
DROP INDEX IF EXISTS idx_staffing_rules_class;
DROP INDEX IF EXISTS idx_enrollments_class;
DROP INDEX IF EXISTS idx_classroom_allowed_classes_class;
DROP INDEX IF EXISTS idx_schedule_cells_class;
DROP INDEX IF EXISTS idx_teacher_schedules_class_day_time;
DROP INDEX IF EXISTS idx_enrollments_class_day_time;
DROP INDEX IF EXISTS idx_staffing_rules_class_day_time;
DROP INDEX IF EXISTS idx_schedule_cells_class_active;

-- 3) Drop class_id columns (legacy)
ALTER TABLE teacher_schedules
  DROP COLUMN IF EXISTS class_id;

ALTER TABLE staffing_rules
  DROP COLUMN IF EXISTS class_id;

ALTER TABLE enrollments
  DROP COLUMN IF EXISTS class_id;

ALTER TABLE class_classroom_mappings
  DROP COLUMN IF EXISTS class_id;

ALTER TABLE classroom_allowed_classes
  DROP COLUMN IF EXISTS class_id;

ALTER TABLE sub_class_preferences
  DROP COLUMN IF EXISTS class_id;

ALTER TABLE schedule_cells
  DROP COLUMN IF EXISTS class_id;

-- 4) Drop legacy classes table
DROP TABLE IF EXISTS classes;

COMMIT;
