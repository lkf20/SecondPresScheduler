-- Add is_floater column to sub_assignments for floater sub coverage (0.5 weight per room).
-- When true, allows a sub to be assigned to up to 2 rooms at the same date/slot.

ALTER TABLE sub_assignments
  ADD COLUMN IF NOT EXISTS is_floater BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sub_assignments_is_floater
  ON sub_assignments(is_floater) WHERE is_floater = true;
