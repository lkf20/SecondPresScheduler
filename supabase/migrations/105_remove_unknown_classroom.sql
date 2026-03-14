-- Migration 105: Remove "Unknown (needs review)" classroom placeholder
-- The app no longer uses this placeholder (trigger 104, API validation, coverage-request omit).
-- Backfill coverage_request_shifts that reference it from teacher_schedules where possible;
-- for any that cannot be resolved (teacher has no scheduled classroom), delete those shift
-- rows so the Unknown classroom can be removed (sub_assignments CASCADE; triggers update totals).

DO $$
DECLARE
  v_unknown_ids UUID[];
  v_shift RECORD;
  v_new_classroom_id UUID;
  v_unresolved_count INT := 0;
  v_unresolved_ids UUID[] := '{}';
BEGIN
  -- Collect Unknown classroom id(s) (may exist per school)
  SELECT ARRAY_AGG(id) INTO v_unknown_ids
  FROM classrooms
  WHERE name = 'Unknown (needs review)';

  IF v_unknown_ids IS NULL OR array_length(v_unknown_ids, 1) IS NULL THEN
    RETURN; -- No Unknown classroom(s), nothing to do
  END IF;

  -- Backfill coverage_request_shifts that reference Unknown: set classroom_id from teacher_schedules
  FOR v_shift IN
    SELECT crs.id AS shift_id,
           crs.coverage_request_id,
           crs.day_of_week_id,
           crs.time_slot_id,
           crs.school_id,
           cr.teacher_id
    FROM coverage_request_shifts crs
    JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
    WHERE crs.classroom_id = ANY(v_unknown_ids)
  LOOP
    SELECT ts.classroom_id INTO v_new_classroom_id
    FROM teacher_schedules ts
    WHERE ts.teacher_id = v_shift.teacher_id
      AND ts.school_id = v_shift.school_id
      AND ts.day_of_week_id = v_shift.day_of_week_id
      AND ts.time_slot_id = v_shift.time_slot_id
      AND ts.classroom_id IS NOT NULL
    LIMIT 1;

    IF v_new_classroom_id IS NOT NULL THEN
      UPDATE coverage_request_shifts
      SET classroom_id = v_new_classroom_id
      WHERE id = v_shift.shift_id;
    ELSE
      v_unresolved_count := v_unresolved_count + 1;
      v_unresolved_ids := array_append(v_unresolved_ids, v_shift.shift_id);
    END IF;
  END LOOP;

  -- Remove shifts that could not be backfilled (no teacher_schedule for that day/slot).
  -- CASCADE deletes their sub_assignments; triggers update coverage_request totals.
  IF v_unresolved_count > 0 THEN
    DELETE FROM coverage_request_shifts
    WHERE id = ANY(v_unresolved_ids);
  END IF;

  -- Keep sub_assignments in sync: point to same classroom as their coverage_request_shift
  UPDATE sub_assignments sa
  SET classroom_id = crs.classroom_id
  FROM coverage_request_shifts crs
  WHERE sa.coverage_request_shift_id = crs.id
    AND sa.classroom_id = ANY(v_unknown_ids);

  -- Remove the Unknown classroom row(s)
  DELETE FROM classrooms
  WHERE name = 'Unknown (needs review)';
END $$;
