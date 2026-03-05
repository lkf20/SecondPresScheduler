-- Per-class-group enrollment and slot-based staffing overrides
-- 1) enrollment per class group in a schedule cell (for "Toddler A (3), Toddler B (2)")
ALTER TABLE schedule_cell_class_groups
  ADD COLUMN IF NOT EXISTS enrollment INTEGER NULL;

-- 2) optional override of required/preferred staff count per schedule cell (e.g. nap time = 1)
ALTER TABLE schedule_cells
  ADD COLUMN IF NOT EXISTS required_staff_override INTEGER NULL,
  ADD COLUMN IF NOT EXISTS preferred_staff_override INTEGER NULL;
