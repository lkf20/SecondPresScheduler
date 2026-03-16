-- Enforce at most one active sub per coverage_request_shift (one sub per person/classroom/slot)
-- and at most one active non-floater assignment per (sub_id, date, time_slot_id) (sub not in
-- two rooms same time unless marked floater).
-- See docs/sub-assignment-integrity.md.

-- 1) Clean duplicate active rows per coverage_request_shift_id (keep one per shift, cancel the rest)
WITH dup_shifts AS (
  SELECT coverage_request_shift_id
  FROM sub_assignments
  WHERE status = 'active'
  GROUP BY coverage_request_shift_id
  HAVING COUNT(*) > 1
),
keep_one_per_shift AS (
  SELECT DISTINCT ON (sa.coverage_request_shift_id) sa.id
  FROM sub_assignments sa
  INNER JOIN dup_shifts d ON d.coverage_request_shift_id = sa.coverage_request_shift_id
  WHERE sa.status = 'active'
  ORDER BY sa.coverage_request_shift_id, sa.created_at DESC NULLS LAST, sa.id DESC
)
UPDATE sub_assignments
SET status = 'cancelled'
WHERE status = 'active'
  AND coverage_request_shift_id IN (SELECT coverage_request_shift_id FROM dup_shifts)
  AND id NOT IN (SELECT id FROM keep_one_per_shift);

-- 2) Clean duplicate active non-floater rows per (sub_id, date, time_slot_id) (keep one, cancel the rest)
WITH dup_sub_slot AS (
  SELECT sub_id, date, time_slot_id
  FROM sub_assignments
  WHERE status = 'active' AND is_floater = false
  GROUP BY sub_id, date, time_slot_id
  HAVING COUNT(*) > 1
),
keep_one_per_sub_slot AS (
  SELECT DISTINCT ON (sa.sub_id, sa.date, sa.time_slot_id) sa.id
  FROM sub_assignments sa
  INNER JOIN dup_sub_slot d
    ON d.sub_id = sa.sub_id AND d.date = sa.date AND d.time_slot_id = sa.time_slot_id
  WHERE sa.status = 'active' AND sa.is_floater = false
  ORDER BY sa.sub_id, sa.date, sa.time_slot_id, sa.created_at DESC NULLS LAST, sa.id DESC
)
UPDATE sub_assignments
SET status = 'cancelled'
WHERE status = 'active'
  AND is_floater = false
  AND (sub_id, date, time_slot_id) IN (SELECT sub_id, date, time_slot_id FROM dup_sub_slot)
  AND id NOT IN (SELECT id FROM keep_one_per_sub_slot);

-- 3) One active sub per coverage_request_shift_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_assignments_one_active_per_shift
  ON sub_assignments (coverage_request_shift_id)
  WHERE status = 'active';

-- 4) Sub not in two rooms same date/slot unless floater (allow multiple rows when is_floater = true)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_assignments_one_active_non_floater_per_slot
  ON sub_assignments (sub_id, date, time_slot_id)
  WHERE status = 'active' AND is_floater = false;
