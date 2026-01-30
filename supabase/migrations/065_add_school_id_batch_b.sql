BEGIN;

-- Batch B: staff + subs + contact tables
-- Tables: staff, staff_role_types, sub_availability, sub_availability_exception_headers,
--         sub_availability_exceptions, sub_class_preferences, sub_contact_log,
--         sub_contact_overrides, sub_contact_shift_overrides, substitute_contacts,
--         teacher_schedule_audit_log

-- 1) Add school_id columns (nullable for now)
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE staff_role_types
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE sub_availability
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE sub_availability_exception_headers
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE sub_availability_exceptions
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE sub_class_preferences
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE sub_contact_log
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE sub_contact_overrides
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE sub_contact_shift_overrides
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE substitute_contacts
  ADD COLUMN IF NOT EXISTS school_id UUID;

ALTER TABLE teacher_schedule_audit_log
  ADD COLUMN IF NOT EXISTS school_id UUID;

-- 2) Backfill staff.school_id
-- Prefer profiles.school_id by user_id; fallback to default
UPDATE staff s
SET school_id = p.school_id
FROM profiles p
WHERE p.user_id = s.id
  AND s.school_id IS NULL
  AND p.school_id IS NOT NULL;

UPDATE staff
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

-- 3) Backfill staff_role_types.school_id (default school for now)
UPDATE staff_role_types
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

-- 4) Backfill sub_availability + exceptions via staff (sub_id)
UPDATE sub_availability sa
SET school_id = s.school_id
FROM staff s
WHERE sa.sub_id = s.id
  AND sa.school_id IS NULL
  AND s.school_id IS NOT NULL;

UPDATE sub_availability_exception_headers sah
SET school_id = s.school_id
FROM staff s
WHERE sah.sub_id = s.id
  AND sah.school_id IS NULL
  AND s.school_id IS NOT NULL;

UPDATE sub_availability_exceptions sae
SET school_id = sah.school_id
FROM sub_availability_exception_headers sah
WHERE sae.exception_header_id = sah.id
  AND sae.school_id IS NULL
  AND sah.school_id IS NOT NULL;

-- 5) Backfill sub_class_preferences via staff (sub_id)
UPDATE sub_class_preferences scp
SET school_id = s.school_id
FROM staff s
WHERE scp.sub_id = s.id
  AND scp.school_id IS NULL
  AND s.school_id IS NOT NULL;

-- 6) Backfill contact tables via coverage_requests
-- sub_contact_log does not have coverage_request_id; use teacher_id (or sub_id) from staff
UPDATE sub_contact_log scl
SET school_id = s.school_id
FROM staff s
WHERE scl.teacher_id = s.id
  AND scl.school_id IS NULL
  AND s.school_id IS NOT NULL;

UPDATE sub_contact_log scl
SET school_id = s.school_id
FROM staff s
WHERE scl.sub_id = s.id
  AND scl.school_id IS NULL
  AND s.school_id IS NOT NULL;

-- sub_contact_overrides does not have coverage_request_id; use teacher_id (or sub_id) from staff
UPDATE sub_contact_overrides sco
SET school_id = s.school_id
FROM staff s
WHERE sco.teacher_id = s.id
  AND sco.school_id IS NULL
  AND s.school_id IS NOT NULL;

UPDATE sub_contact_overrides sco
SET school_id = s.school_id
FROM staff s
WHERE sco.sub_id = s.id
  AND sco.school_id IS NULL
  AND s.school_id IS NOT NULL;

-- sub_contact_shift_overrides has substitute_contact_id and coverage_request_shift_id
UPDATE sub_contact_shift_overrides scso
SET school_id = sc.school_id
FROM substitute_contacts sc
WHERE scso.substitute_contact_id = sc.id
  AND scso.school_id IS NULL
  AND sc.school_id IS NOT NULL;

UPDATE sub_contact_shift_overrides scso
SET school_id = cr.school_id
FROM coverage_request_shifts crs
JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
WHERE scso.coverage_request_shift_id = crs.id
  AND scso.school_id IS NULL
  AND cr.school_id IS NOT NULL;

UPDATE substitute_contacts sc
SET school_id = cr.school_id
FROM coverage_requests cr
WHERE sc.coverage_request_id = cr.id
  AND sc.school_id IS NULL
  AND cr.school_id IS NOT NULL;

-- 7) Backfill teacher_schedule_audit_log via teacher_schedules
UPDATE teacher_schedule_audit_log tsal
SET school_id = ts.school_id
FROM teacher_schedules ts
WHERE tsal.teacher_schedule_id = ts.id
  AND tsal.school_id IS NULL
  AND ts.school_id IS NOT NULL;

-- 8) Fallback to default school id
UPDATE sub_availability
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE sub_availability_exception_headers
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE sub_availability_exceptions
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE sub_class_preferences
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE sub_contact_log
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE sub_contact_overrides
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE sub_contact_shift_overrides
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE substitute_contacts
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

UPDATE teacher_schedule_audit_log
SET school_id = '00000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

-- 9) Add indexes
CREATE INDEX IF NOT EXISTS idx_staff_school_id
  ON staff(school_id);

CREATE INDEX IF NOT EXISTS idx_staff_role_types_school_id
  ON staff_role_types(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_availability_school_id
  ON sub_availability(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_availability_exception_headers_school_id
  ON sub_availability_exception_headers(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_availability_exceptions_school_id
  ON sub_availability_exceptions(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_class_preferences_school_id
  ON sub_class_preferences(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_contact_log_school_id
  ON sub_contact_log(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_contact_overrides_school_id
  ON sub_contact_overrides(school_id);

CREATE INDEX IF NOT EXISTS idx_sub_contact_shift_overrides_school_id
  ON sub_contact_shift_overrides(school_id);

CREATE INDEX IF NOT EXISTS idx_substitute_contacts_school_id
  ON substitute_contacts(school_id);

CREATE INDEX IF NOT EXISTS idx_teacher_schedule_audit_log_school_id
  ON teacher_schedule_audit_log(school_id);

-- 10) (Optional) Set NOT NULL once you confirm 100% backfill success
-- Run these checks first:
--   SELECT * FROM staff WHERE school_id IS NULL;
--   SELECT * FROM staff_role_types WHERE school_id IS NULL;
--   SELECT * FROM sub_availability WHERE school_id IS NULL;
--   SELECT * FROM sub_availability_exception_headers WHERE school_id IS NULL;
--   SELECT * FROM sub_availability_exceptions WHERE school_id IS NULL;
--   SELECT * FROM sub_class_preferences WHERE school_id IS NULL;
--   SELECT * FROM sub_contact_log WHERE school_id IS NULL;
--   SELECT * FROM sub_contact_overrides WHERE school_id IS NULL;
--   SELECT * FROM sub_contact_shift_overrides WHERE school_id IS NULL;
--   SELECT * FROM substitute_contacts WHERE school_id IS NULL;
--   SELECT * FROM teacher_schedule_audit_log WHERE school_id IS NULL;
--
-- If they return 0 rows, you may then do:
-- ALTER TABLE staff ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE staff_role_types ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE sub_availability ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE sub_availability_exception_headers ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE sub_availability_exceptions ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE sub_class_preferences ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE sub_contact_log ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE sub_contact_overrides ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE sub_contact_shift_overrides ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE substitute_contacts ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE teacher_schedule_audit_log ALTER COLUMN school_id SET NOT NULL;

COMMIT;
