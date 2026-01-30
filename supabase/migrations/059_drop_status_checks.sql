BEGIN;

-- Drop legacy CHECK constraints before replacing text columns with enums
ALTER TABLE coverage_requests
  DROP CONSTRAINT IF EXISTS coverage_requests_status_check,
  DROP CONSTRAINT IF EXISTS coverage_requests_request_type_check;

ALTER TABLE coverage_request_shifts
  DROP CONSTRAINT IF EXISTS coverage_request_shifts_status_check;

ALTER TABLE time_off_requests
  DROP CONSTRAINT IF EXISTS time_off_requests_status_check;

ALTER TABLE sub_assignments
  DROP CONSTRAINT IF EXISTS sub_assignments_status_check;

COMMIT;
