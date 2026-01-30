BEGIN;

-- 1) Add school_id columns (nullable for now)
ALTER TABLE time_off_requests
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE sub_assignments
  ADD COLUMN IF NOT EXISTS school_id UUID;

-- 2) Backfill time_off_requests.school_id
-- Prefer coverage_requests.school_id via coverage_request_id
UPDATE time_off_requests tor
SET school_id = cr.school_id
FROM coverage_requests cr
WHERE tor.coverage_request_id = cr.id
  AND tor.school_id IS NULL
  AND cr.school_id IS NOT NULL;

-- Fallback to teacher_schedules.school_id via teacher_id
UPDATE time_off_requests tor
SET school_id = ts.school_id
FROM teacher_schedules ts
WHERE tor.teacher_id = ts.teacher_id
  AND tor.school_id IS NULL
  AND ts.school_id IS NOT NULL;

UPDATE time_off_requests
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

-- 3) Backfill sub_assignments.school_id
-- Prefer coverage_request_shifts -> coverage_requests.school_id
UPDATE sub_assignments sa
SET school_id = cr.school_id
FROM coverage_request_shifts crs
JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
WHERE sa.coverage_request_shift_id = crs.id
  AND sa.school_id IS NULL
  AND cr.school_id IS NOT NULL;

-- Fallback to default school id if still NULL
UPDATE sub_assignments
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

-- 4) Add indexes
CREATE INDEX IF NOT EXISTS idx_time_off_requests_school_id
  ON time_off_requests(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_assignments_school_id
  ON sub_assignments(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_assignments_active
  ON sub_assignments (school_id, status)
  WHERE status = 'active';

-- 5) (Optional) Set NOT NULL once you confirm 100% backfill success
-- Run these checks first:
--   SELECT * FROM time_off_requests WHERE school_id IS NULL;
--   SELECT * FROM sub_assignments WHERE school_id IS NULL;
--
-- If they return 0 rows, you may then do:
-- ALTER TABLE time_off_requests ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE sub_assignments ALTER COLUMN school_id SET NOT NULL;

COMMIT;
