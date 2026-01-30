BEGIN;

-- Ensure only expected values exist before converting to enums
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM time_off_requests
    WHERE shift_selection_mode IS NOT NULL
      AND shift_selection_mode NOT IN ('select_shifts', 'all_scheduled')
  ) THEN
    RAISE EXCEPTION 'Unexpected time_off_requests.shift_selection_mode values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sub_contact_log
    WHERE contact_status IS NOT NULL
      AND contact_status NOT IN ('no_response', 'pending', 'confirmed', 'declined')
  ) THEN
    RAISE EXCEPTION 'Unexpected sub_contact_log.contact_status values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM profiles
    WHERE role IS NOT NULL
      AND role NOT IN ('admin', 'director', 'teacher', 'viewer')
  ) THEN
    RAISE EXCEPTION 'Unexpected profiles.role values exist';
  END IF;
END $$;

-- Drop existing check constraint (added by 011_add_shift_selection_mode.sql)
ALTER TABLE time_off_requests
  DROP CONSTRAINT IF EXISTS time_off_requests_shift_selection_mode_check;

-- Drop defaults before type changes to avoid cast errors
ALTER TABLE time_off_requests
  ALTER COLUMN shift_selection_mode DROP DEFAULT;

ALTER TABLE sub_contact_log
  ALTER COLUMN contact_status DROP DEFAULT;

ALTER TABLE profiles
  ALTER COLUMN role DROP DEFAULT;

-- Create enums
CREATE TYPE time_off_shift_selection_mode AS ENUM ('select_shifts', 'all_scheduled');
CREATE TYPE sub_contact_status AS ENUM ('no_response', 'pending', 'confirmed', 'declined');
CREATE TYPE profile_role AS ENUM ('admin', 'director', 'teacher', 'viewer');

-- Convert columns to enums
ALTER TABLE time_off_requests
  ALTER COLUMN shift_selection_mode TYPE time_off_shift_selection_mode
    USING shift_selection_mode::time_off_shift_selection_mode;

ALTER TABLE sub_contact_log
  ALTER COLUMN contact_status TYPE sub_contact_status
    USING contact_status::sub_contact_status;

ALTER TABLE profiles
  ALTER COLUMN role TYPE profile_role
    USING role::profile_role;

-- Set defaults
ALTER TABLE time_off_requests
  ALTER COLUMN shift_selection_mode SET DEFAULT 'all_scheduled';

ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'director';

COMMIT;
