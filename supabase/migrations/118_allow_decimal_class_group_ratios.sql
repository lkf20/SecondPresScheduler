-- Allow one decimal place in class group ratios (e.g., 3.3 children per teacher)
ALTER TABLE class_groups
  ALTER COLUMN required_ratio TYPE NUMERIC(4,1) USING required_ratio::NUMERIC(4,1),
  ALTER COLUMN preferred_ratio TYPE NUMERIC(4,1) USING preferred_ratio::NUMERIC(4,1),
  ALTER COLUMN required_ratio SET DEFAULT 8.0;

ALTER TABLE class_groups
  DROP CONSTRAINT IF EXISTS class_groups_required_ratio_min_check,
  DROP CONSTRAINT IF EXISTS class_groups_required_ratio_precision_check,
  DROP CONSTRAINT IF EXISTS class_groups_preferred_ratio_min_check,
  DROP CONSTRAINT IF EXISTS class_groups_preferred_ratio_precision_check;

ALTER TABLE class_groups
  ADD CONSTRAINT class_groups_required_ratio_min_check
    CHECK (required_ratio >= 1.0),
  ADD CONSTRAINT class_groups_required_ratio_precision_check
    CHECK (required_ratio = round(required_ratio, 1)),
  ADD CONSTRAINT class_groups_preferred_ratio_min_check
    CHECK (preferred_ratio IS NULL OR preferred_ratio >= 1.0),
  ADD CONSTRAINT class_groups_preferred_ratio_precision_check
    CHECK (preferred_ratio IS NULL OR preferred_ratio = round(preferred_ratio, 1));
