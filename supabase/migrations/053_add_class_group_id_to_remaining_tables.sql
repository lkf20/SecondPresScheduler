BEGIN;

-- 1) Add class_group_id columns (nullable for now)
ALTER TABLE teacher_schedules
  ADD COLUMN IF NOT EXISTS class_group_id UUID;

ALTER TABLE staffing_rules
  ADD COLUMN IF NOT EXISTS class_group_id UUID;

ALTER TABLE sub_class_preferences
  ADD COLUMN IF NOT EXISTS class_group_id UUID;

-- 2) Backfill class_group_id by joining classes → class_groups on name
-- Assumes classes.name == class_groups.name; adjust join if needed.
UPDATE teacher_schedules ts
SET class_group_id = cg.id
FROM classes c
JOIN class_groups cg ON cg.name = c.name
WHERE ts.class_id = c.id
  AND ts.class_group_id IS NULL;

UPDATE staffing_rules sr
SET class_group_id = cg.id
FROM classes c
JOIN class_groups cg ON cg.name = c.name
WHERE sr.class_id = c.id
  AND sr.class_group_id IS NULL;

UPDATE sub_class_preferences scp
SET class_group_id = cg.id
FROM classes c
JOIN class_groups cg ON cg.name = c.name
WHERE scp.class_id = c.id
  AND scp.class_group_id IS NULL;

-- 3) Add foreign key constraints for class_group_id → class_groups(id)
ALTER TABLE teacher_schedules
  ADD CONSTRAINT teacher_schedules_class_group_id_fkey
  FOREIGN KEY (class_group_id)
  REFERENCES class_groups(id)
  ON DELETE RESTRICT;

ALTER TABLE staffing_rules
  ADD CONSTRAINT staffing_rules_class_group_id_fkey
  FOREIGN KEY (class_group_id)
  REFERENCES class_groups(id)
  ON DELETE RESTRICT;

ALTER TABLE sub_class_preferences
  ADD CONSTRAINT sub_class_preferences_class_group_id_fkey
  FOREIGN KEY (class_group_id)
  REFERENCES class_groups(id)
  ON DELETE RESTRICT;

-- 4) Add indexes for new class_group_id columns
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_class_group_id
  ON teacher_schedules(class_group_id);

CREATE INDEX IF NOT EXISTS idx_staffing_rules_class_group_id
  ON staffing_rules(class_group_id);

CREATE INDEX IF NOT EXISTS idx_sub_class_preferences_class_group_id
  ON sub_class_preferences(class_group_id);

-- 5) (Optional) Set NOT NULL once you confirm 100% backfill success
-- Run these checks first:
--   SELECT * FROM teacher_schedules WHERE class_group_id IS NULL;
--   SELECT * FROM staffing_rules WHERE class_group_id IS NULL;
--   SELECT * FROM sub_class_preferences WHERE class_group_id IS NULL;
--
-- If they all return 0 rows, you *may* then do:
-- ALTER TABLE teacher_schedules ALTER COLUMN class_group_id SET NOT NULL;
-- ALTER TABLE staffing_rules ALTER COLUMN class_group_id SET NOT NULL;
-- ALTER TABLE sub_class_preferences ALTER COLUMN class_group_id SET NOT NULL;

COMMIT;
