BEGIN;

-- 1) Add class_group_id columns (nullable for now)
ALTER TABLE class_classroom_mappings
  ADD COLUMN IF NOT EXISTS class_group_id UUID;

ALTER TABLE classroom_allowed_classes
  ADD COLUMN IF NOT EXISTS class_group_id UUID;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS class_group_id UUID;

-- 2) Backfill class_group_id by joining classes → class_groups on name
-- Assumes classes.name == class_groups.name; adjust join if needed.
UPDATE class_classroom_mappings ccm
SET class_group_id = cg.id
FROM classes c
JOIN class_groups cg ON cg.name = c.name
WHERE ccm.class_id = c.id
  AND ccm.class_group_id IS NULL;

UPDATE classroom_allowed_classes cac
SET class_group_id = cg.id
FROM classes c
JOIN class_groups cg ON cg.name = c.name
WHERE cac.class_id = c.id
  AND cac.class_group_id IS NULL;

UPDATE enrollments e
SET class_group_id = cg.id
FROM classes c
JOIN class_groups cg ON cg.name = c.name
WHERE e.class_id = c.id
  AND e.class_group_id IS NULL;

-- 3) Add foreign key constraints for class_group_id → class_groups(id)
-- Use RESTRICT so these rows can't be deleted while still referenced.
ALTER TABLE class_classroom_mappings
  ADD CONSTRAINT class_classroom_mappings_class_group_id_fkey
  FOREIGN KEY (class_group_id)
  REFERENCES class_groups(id)
  ON DELETE RESTRICT;

ALTER TABLE classroom_allowed_classes
  ADD CONSTRAINT classroom_allowed_classes_class_group_id_fkey
  FOREIGN KEY (class_group_id)
  REFERENCES class_groups(id)
  ON DELETE RESTRICT;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_class_group_id_fkey
  FOREIGN KEY (class_group_id)
  REFERENCES class_groups(id)
  ON DELETE RESTRICT;

-- 3b) Add indexes for new class_group_id columns
CREATE INDEX IF NOT EXISTS idx_class_classroom_mappings_class_group_id
  ON class_classroom_mappings(class_group_id);

CREATE INDEX IF NOT EXISTS idx_classroom_allowed_classes_class_group_id
  ON classroom_allowed_classes(class_group_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_class_group_id
  ON enrollments(class_group_id);

-- 4) (Optional) Set NOT NULL once you confirm 100% backfill success
-- Run these checks first:
--   SELECT * FROM class_classroom_mappings WHERE class_group_id IS NULL;
--   SELECT * FROM classroom_allowed_classes WHERE class_group_id IS NULL;
--   SELECT * FROM enrollments WHERE class_group_id IS NULL;
--
-- If they all return 0 rows, you *may* then do:
-- ALTER TABLE class_classroom_mappings ALTER COLUMN class_group_id SET NOT NULL;
-- ALTER TABLE classroom_allowed_classes ALTER COLUMN class_group_id SET NOT NULL;
-- ALTER TABLE enrollments ALTER COLUMN class_group_id SET NOT NULL;

COMMIT;
