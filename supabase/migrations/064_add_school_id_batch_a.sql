BEGIN;

-- Batch A: classroom + schedule tables
-- Tables: class_classroom_mappings, classroom_allowed_classes, classroom_preferences,
--         enrollments, schedule_cell_class_groups, time_off_shifts

-- 1) Add school_id columns (nullable for now)
ALTER TABLE class_classroom_mappings
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE classroom_allowed_classes
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE classroom_preferences
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE schedule_cell_class_groups
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE time_off_shifts
  ADD COLUMN IF NOT EXISTS school_id UUID;

-- 2) Backfill school_id from related tables
UPDATE class_classroom_mappings ccm
SET school_id = c.school_id
FROM classrooms c
WHERE ccm.classroom_id = c.id
  AND ccm.school_id IS NULL
  AND c.school_id IS NOT NULL;

UPDATE classroom_allowed_classes cac
SET school_id = c.school_id
FROM classrooms c
WHERE cac.classroom_id = c.id
  AND cac.school_id IS NULL
  AND c.school_id IS NOT NULL;

UPDATE classroom_preferences cp
SET school_id = c.school_id
FROM classrooms c
WHERE cp.classroom_id = c.id
  AND cp.school_id IS NULL
  AND c.school_id IS NOT NULL;

UPDATE enrollments e
SET school_id = cg.school_id
FROM class_groups cg
WHERE e.class_group_id = cg.id
  AND e.school_id IS NULL
  AND cg.school_id IS NOT NULL;

UPDATE schedule_cell_class_groups sccg
SET school_id = sc.school_id
FROM schedule_cells sc
WHERE sccg.schedule_cell_id = sc.id
  AND sccg.school_id IS NULL
  AND sc.school_id IS NOT NULL;

UPDATE time_off_shifts tos
SET school_id = tor.school_id
FROM time_off_requests tor
WHERE tos.time_off_request_id = tor.id
  AND tos.school_id IS NULL
  AND tor.school_id IS NOT NULL;

-- 3) Fallback to default school id
UPDATE class_classroom_mappings
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE classroom_allowed_classes
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE classroom_preferences
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE enrollments
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE schedule_cell_class_groups
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE time_off_shifts
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

-- 4) Add indexes
CREATE INDEX IF NOT EXISTS idx_class_classroom_mappings_school_id
  ON class_classroom_mappings(school_id);

CREATE INDEX IF NOT EXISTS idx_classroom_allowed_classes_school_id
  ON classroom_allowed_classes(school_id);

CREATE INDEX IF NOT EXISTS idx_classroom_preferences_school_id
  ON classroom_preferences(school_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_school_id
  ON enrollments(school_id);

CREATE INDEX IF NOT EXISTS idx_schedule_cell_class_groups_school_id
  ON schedule_cell_class_groups(school_id);

CREATE INDEX IF NOT EXISTS idx_time_off_shifts_school_id
  ON time_off_shifts(school_id);

-- 5) (Optional) Set NOT NULL once you confirm 100% backfill success
-- Run these checks first:
--   SELECT * FROM class_classroom_mappings WHERE school_id IS NULL;
--   SELECT * FROM classroom_allowed_classes WHERE school_id IS NULL;
--   SELECT * FROM classroom_preferences WHERE school_id IS NULL;
--   SELECT * FROM enrollments WHERE school_id IS NULL;
--   SELECT * FROM schedule_cell_class_groups WHERE school_id IS NULL;
--   SELECT * FROM time_off_shifts WHERE school_id IS NULL;
--
-- If they return 0 rows, you may then do:
-- ALTER TABLE class_classroom_mappings ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE classroom_allowed_classes ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE classroom_preferences ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE enrollments ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE schedule_cell_class_groups ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE time_off_shifts ALTER COLUMN school_id SET NOT NULL;

COMMIT;
