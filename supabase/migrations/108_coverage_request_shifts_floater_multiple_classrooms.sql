-- Allow multiple coverage_request_shifts per (coverage_request_id, date, time_slot_id)
-- when the teacher is a floater (multiple classrooms in the same slot).
-- Change UNIQUE(coverage_request_id, date, time_slot_id) to
-- UNIQUE(coverage_request_id, date, time_slot_id, classroom_id).

BEGIN;

-- Drop the existing unique constraint (name from 031)
ALTER TABLE coverage_request_shifts
  DROP CONSTRAINT IF EXISTS coverage_request_shifts_coverage_request_id_date_time_slot_id_key;

-- Add new unique constraint including classroom_id
ALTER TABLE coverage_request_shifts
  ADD CONSTRAINT coverage_request_shifts_request_date_slot_classroom_key
  UNIQUE (coverage_request_id, date, time_slot_id, classroom_id);

COMMIT;
