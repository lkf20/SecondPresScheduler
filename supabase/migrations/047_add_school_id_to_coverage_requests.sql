-- Migration 047: Add school_id to coverage_requests and coverage_request_shifts for multi-tenancy support
-- This migration adds school_id columns to coverage request tables to enable school-level filtering

-- Step 1: Get the default school ID (same one used in migration 044 and 045)
DO $$
DECLARE
  default_school_id UUID;
BEGIN
  SELECT id INTO default_school_id
  FROM schools
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  IF default_school_id IS NULL THEN
    INSERT INTO schools (id, name)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Second Presbyterian Weekday School')
    RETURNING id INTO default_school_id;
  END IF;

  -- Step 2: Add school_id to coverage_requests
  ALTER TABLE coverage_requests
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 3: Add school_id to coverage_request_shifts
  ALTER TABLE coverage_request_shifts
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE RESTRICT;

  -- Step 4: Backfill coverage_requests with school_id from teacher's profile or teacher_schedules
  -- First, try to get school_id from profiles (via teacher_id -> user_id -> profile.school_id)
  -- For teachers that don't have profiles, fall back to teacher_schedules
  UPDATE coverage_requests cr
  SET school_id = COALESCE(
    -- Try to get from profile first (most reliable)
    (SELECT p.school_id 
     FROM profiles p 
     INNER JOIN auth.users u ON u.id = p.user_id 
     WHERE u.id = cr.teacher_id 
     LIMIT 1),
    -- Fall back to teacher_schedules (most common school)
    (SELECT ts.school_id 
     FROM teacher_schedules ts 
     WHERE ts.teacher_id = cr.teacher_id 
     GROUP BY ts.school_id 
     ORDER BY COUNT(*) DESC 
     LIMIT 1),
    -- Default to the default school if nothing found
    default_school_id
  )
  WHERE cr.school_id IS NULL;

  -- Step 5: Backfill coverage_request_shifts with school_id from parent coverage_request
  UPDATE coverage_request_shifts crs
  SET school_id = cr.school_id
  FROM coverage_requests cr
  WHERE crs.coverage_request_id = cr.id
    AND crs.school_id IS NULL;

  -- Step 6: Make school_id NOT NULL after backfilling
  ALTER TABLE coverage_requests
    ALTER COLUMN school_id SET NOT NULL;

  ALTER TABLE coverage_request_shifts
    ALTER COLUMN school_id SET NOT NULL;

  -- Step 7: Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_coverage_requests_school_id ON coverage_requests(school_id);
  CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_school_id ON coverage_request_shifts(school_id);

  RAISE NOTICE 'Added school_id columns to coverage_requests and coverage_request_shifts, backfilled with default school: %', default_school_id;
END $$;
