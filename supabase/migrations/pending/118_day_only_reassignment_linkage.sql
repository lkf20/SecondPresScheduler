-- Migration 118: Day-only reassignment linkage support
-- Adds optional source/coverage linkage fields for staffing_event_shifts and
-- optional staffing_event_shift linkage on sub_assignments.

BEGIN;

-- ============================================================================
-- 1) Expand staffing_events.event_category to include 'reassignment'
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'staffing_events'::regclass
      AND contype = 'c'
      AND conkey @> ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = 'staffing_events'::regclass
            AND attname = 'event_category'
        )::smallint
      ]
  ) LOOP
    EXECUTE 'ALTER TABLE staffing_events DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE staffing_events
ADD CONSTRAINT staffing_events_event_category_check
CHECK (event_category IN ('standard', 'break', 'reassignment'));

-- ============================================================================
-- 2) Add reassignment linkage fields on staffing_event_shifts
-- ============================================================================
ALTER TABLE staffing_event_shifts
ADD COLUMN IF NOT EXISTS source_classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS coverage_request_shift_id UUID REFERENCES coverage_request_shifts(id) ON DELETE SET NULL;

-- If source classroom is provided, it must differ from target classroom.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staffing_event_shifts_source_not_target_check'
      AND conrelid = 'staffing_event_shifts'::regclass
  ) THEN
    ALTER TABLE staffing_event_shifts
    ADD CONSTRAINT staffing_event_shifts_source_not_target_check
    CHECK (source_classroom_id IS NULL OR source_classroom_id <> classroom_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staffing_event_shifts_coverage_request_shift
  ON staffing_event_shifts (coverage_request_shift_id);

CREATE INDEX IF NOT EXISTS idx_staffing_event_shifts_active_source_slot
  ON staffing_event_shifts (school_id, date, time_slot_id, source_classroom_id)
  WHERE status = 'active' AND source_classroom_id IS NOT NULL;

-- ============================================================================
-- 3) Add optional reverse link on sub_assignments
-- ============================================================================
ALTER TABLE sub_assignments
ADD COLUMN IF NOT EXISTS staffing_event_shift_id UUID REFERENCES staffing_event_shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sub_assignments_staffing_event_shift
  ON sub_assignments (staffing_event_shift_id);

-- One active sub_assignment row per staffing_event_shift_id (when linked).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_assignments_one_active_per_staffing_event_shift
  ON sub_assignments (staffing_event_shift_id)
  WHERE status = 'active' AND staffing_event_shift_id IS NOT NULL;

COMMIT;
