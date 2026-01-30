BEGIN;

-- Ensure only expected values exist before converting to enums
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM coverage_requests
    WHERE request_type IS NOT NULL
      AND request_type::text NOT IN ('time_off', 'extra_coverage')
  ) THEN
    RAISE EXCEPTION 'Unexpected coverage_requests.request_type values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coverage_requests
    WHERE status IS NOT NULL
      AND status NOT IN ('open', 'filled', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Unexpected coverage_requests.status values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coverage_request_shifts
    WHERE status IS NOT NULL
      AND status NOT IN ('active', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Unexpected coverage_request_shifts.status values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM time_off_requests
    WHERE status IS NOT NULL
      AND status NOT IN ('draft', 'active', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Unexpected time_off_requests.status values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sub_assignments
    WHERE status IS NOT NULL
      AND status NOT IN ('active', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Unexpected sub_assignments.status values exist';
  END IF;
END $$;

-- Normalize request_type values
UPDATE coverage_requests
SET request_type = 'extra_coverage'
WHERE request_type::text = 'manual_coverage';

-- Drop defaults before type changes to avoid cast errors
ALTER TABLE coverage_requests
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN request_type DROP DEFAULT;

ALTER TABLE coverage_request_shifts
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE time_off_requests
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE sub_assignments
  ALTER COLUMN status DROP DEFAULT;

-- Create enums (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coverage_request_status') THEN
    CREATE TYPE coverage_request_status AS ENUM ('open', 'filled', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coverage_request_shift_status') THEN
    CREATE TYPE coverage_request_shift_status AS ENUM ('active', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_off_request_status') THEN
    CREATE TYPE time_off_request_status AS ENUM ('draft', 'active', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sub_assignment_status') THEN
    CREATE TYPE sub_assignment_status AS ENUM ('active', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coverage_request_type') THEN
    CREATE TYPE coverage_request_type AS ENUM ('time_off', 'extra_coverage');
  END IF;
END $$;

-- Convert columns to enums
ALTER TABLE coverage_requests
  ALTER COLUMN status TYPE coverage_request_status
    USING status::coverage_request_status,
  ALTER COLUMN request_type TYPE coverage_request_type
    USING request_type::coverage_request_type;

ALTER TABLE coverage_request_shifts
  ALTER COLUMN status TYPE coverage_request_shift_status
    USING status::coverage_request_shift_status;

ALTER TABLE time_off_requests
  ALTER COLUMN status TYPE time_off_request_status
    USING status::time_off_request_status;

ALTER TABLE sub_assignments
  ALTER COLUMN status TYPE sub_assignment_status
    USING status::sub_assignment_status;

-- Set defaults
ALTER TABLE coverage_requests
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN request_type SET DEFAULT 'time_off';

ALTER TABLE coverage_request_shifts
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE time_off_requests
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE sub_assignments
  ALTER COLUMN status SET DEFAULT 'active';

COMMIT;
