-- One-off: Remove the 2 coverage_request_shifts that reference "Unknown (needs review)"
-- and cannot be backfilled (teacher has no scheduled classroom for that day/slot).
-- Run this in Supabase SQL editor against the DB where migration 105 failed, then run:
--   supabase db push
-- so migration 105 can complete and delete the Unknown classroom.
--
-- Effects: Deletes the two shift rows. Sub_assignments and sub_contact_shift_overrides
-- that reference them are removed by CASCADE. The parent coverage_request's total_shifts
-- is updated by trigger. The corresponding time_off_shift rows are NOT deleted (they live
-- in time_off_shifts); you may edit the time off request in the app to drop those dates
-- if desired.

DELETE FROM coverage_request_shifts
WHERE id IN (
  '7d908516-65e8-42ab-8069-a356cb5b5f98',
  'e7920804-0bdf-456b-b969-ffc96c6addf5'
);
