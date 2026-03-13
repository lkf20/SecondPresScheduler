-- Migration 104: Require classroom for coverage_request_shift (no "Unknown" fallback)
-- When a time_off_shift is inserted, the trigger creates a coverage_request_shift.
-- If the teacher has no scheduled classroom for that (day, slot) in the same school,
-- we now RAISE an exception instead of assigning "Unknown (needs review)".
-- This keeps the DB consistent with the "no Unknown" policy and aligns with
-- API validation (time-off creation rejects shifts without classroom).

CREATE OR REPLACE FUNCTION auto_create_coverage_request_shift_from_time_off_shift()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_classroom_id UUID;
  v_school_id UUID;
BEGIN
  -- Get the coverage_request_id from the time_off_request
  SELECT coverage_request_id INTO v_coverage_request_id
  FROM time_off_requests
  WHERE id = NEW.time_off_request_id;

  -- Only proceed if we have a coverage_request
  IF v_coverage_request_id IS NOT NULL THEN
    -- Get school_id from the coverage_request
    SELECT school_id INTO v_school_id
    FROM coverage_requests
    WHERE id = v_coverage_request_id;

    -- Determine classroom_id from teacher_schedules only (same school).
    -- No fallback to "Unknown (needs review)".
    SELECT ts.classroom_id INTO v_classroom_id
    FROM teacher_schedules ts
    JOIN time_off_requests tor ON ts.teacher_id = tor.teacher_id
    WHERE tor.id = NEW.time_off_request_id
      AND ts.day_of_week_id = NEW.day_of_week_id
      AND ts.time_slot_id = NEW.time_slot_id
      AND ts.school_id = v_school_id
      AND ts.classroom_id IS NOT NULL
    LIMIT 1;

    -- Require a classroom; otherwise the time_off_shift insert must fail.
    IF v_classroom_id IS NULL THEN
      RAISE EXCEPTION
        'Cannot create coverage shift: teacher has no scheduled classroom for this day/slot in this school. Add the teacher to the baseline schedule (Settings → Baseline Schedule) first.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Create the coverage_request_shift
    INSERT INTO coverage_request_shifts (
      id,
      coverage_request_id,
      date,
      day_of_week_id,
      time_slot_id,
      classroom_id,
      class_group_id,
      is_partial,
      start_time,
      end_time,
      school_id,
      created_at
    )
    VALUES (
      NEW.id,
      v_coverage_request_id,
      NEW.date,
      NEW.day_of_week_id,
      NEW.time_slot_id,
      v_classroom_id,
      NULL,
      NEW.is_partial,
      NEW.start_time,
      NEW.end_time,
      v_school_id,
      NEW.created_at
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
