-- Allow the same teacher (e.g. floater) to be scheduled in multiple classrooms
-- for the same day and time slot. Previously UNIQUE(teacher_id, day_of_week_id, time_slot_id)
-- allowed only one row per teacher per day/slot globally.
--
-- New constraint: UNIQUE(teacher_id, day_of_week_id, time_slot_id, classroom_id)
-- so a teacher can have one row per classroom per day/slot (floaters in multiple rooms).

BEGIN;

-- Drop the existing unique constraint (PostgreSQL names it table_col1_col2_col3_key)
ALTER TABLE teacher_schedules
  DROP CONSTRAINT IF EXISTS teacher_schedules_teacher_id_day_of_week_id_time_slot_id_key;

-- Add new unique constraint including classroom_id
ALTER TABLE teacher_schedules
  ADD CONSTRAINT teacher_schedules_teacher_day_slot_classroom_key
  UNIQUE (teacher_id, day_of_week_id, time_slot_id, classroom_id);

COMMIT;
