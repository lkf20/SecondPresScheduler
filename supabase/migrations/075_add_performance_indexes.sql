BEGIN;

-- DASHBOARD: coverage + time off summary by school + date range
CREATE INDEX IF NOT EXISTS idx_time_off_requests_school_status_dates
  ON time_off_requests (school_id, status, start_date, end_date);
-- Supports dashboard/time-off queries by school + status + date range

CREATE INDEX IF NOT EXISTS idx_coverage_requests_school_status_dates
  ON coverage_requests (school_id, status, start_date, end_date);
-- Supports dashboard coverage summary by school + status + date range

CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_school_date_status
  ON coverage_request_shifts (school_id, date, status);
-- Supports dashboard shift counts by school + date range + status

CREATE INDEX IF NOT EXISTS idx_sub_assignments_school_date_timeslot
  ON sub_assignments (school_id, date, time_slot_id);
-- Supports dashboard scheduled subs by school + date range

-- WEEKLY SCHEDULE: teacher schedules by school/classroom/day/slot
-- (schedule_cells unique already covers this; do not duplicate)
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_school_classroom_day_time
  ON teacher_schedules (school_id, classroom_id, day_of_week_id, time_slot_id);
-- Supports weekly schedule grid by school + classroom + day + time slot

CREATE INDEX IF NOT EXISTS idx_teacher_schedules_school_teacher
  ON teacher_schedules (school_id, teacher_id);
-- Supports weekly schedule / time-off joins by school + teacher

-- SUB FINDER: subs by availability, preferences, qualifications, assignments
CREATE INDEX IF NOT EXISTS idx_sub_availability_school_sub_day_time
  ON sub_availability (school_id, sub_id, day_of_week_id, time_slot_id);
-- Supports sub finder availability lookups by school + sub + day + slot

CREATE INDEX IF NOT EXISTS idx_sub_availability_exceptions_school_sub_date_time
  ON sub_availability_exceptions (school_id, sub_id, date, time_slot_id);
-- Supports sub finder availability exceptions by school + sub + date + slot

-- sub_class_preferences column may vary across environments; only index if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sub_class_preferences'
      AND column_name = 'class_group_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sub_class_preferences_school_sub_class_group
      ON sub_class_preferences (school_id, sub_id, class_group_id);
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sub_class_preferences'
      AND column_name = 'class_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sub_class_preferences_school_sub_class
      ON sub_class_preferences (school_id, sub_id, class_id);
  END IF;
END $$;
-- Supports sub finder preference filtering by school + sub + class group/class

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_staff_qualification
  ON staff_qualifications (staff_id, qualification_id);
-- Supports sub finder qualification filtering (no school_id column here)

CREATE INDEX IF NOT EXISTS idx_substitute_contacts_school_coverage_sub
  ON substitute_contacts (school_id, coverage_request_id, sub_id);
-- Supports sub finder contact lookup by school + coverage request + sub

CREATE INDEX IF NOT EXISTS idx_sub_contact_shift_overrides_contact_shift
  ON sub_contact_shift_overrides (substitute_contact_id, coverage_request_shift_id);
-- Supports sub finder override lookup per contact + shift

COMMIT;
