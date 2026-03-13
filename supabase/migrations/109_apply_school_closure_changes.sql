-- Atomic delete + add for school closures (used when editing shape: delete then add).
-- Runs in a single transaction so partial failure rolls back everything.
CREATE OR REPLACE FUNCTION apply_school_closure_changes(
  p_school_id UUID,
  p_delete_ids UUID[] DEFAULT '{}'::UUID[],
  p_add_single JSONB DEFAULT '[]'::JSONB,
  p_add_ranges JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  date DATE,
  time_slot_id UUID,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  add_item JSONB;
  range_item JSONB;
  d DATE;
  start_d DATE;
  end_d DATE;
  range_reason TEXT;
  range_notes TEXT;
  day_count INT;
BEGIN
  -- Delete
  IF array_length(p_delete_ids, 1) > 0 THEN
    DELETE FROM school_closures
    WHERE school_closures.school_id = p_school_id
      AND school_closures.id = ANY(p_delete_ids);
  END IF;

  -- Single-day adds
  FOR add_item IN SELECT * FROM jsonb_array_elements(p_add_single)
  LOOP
    INSERT INTO school_closures (school_id, date, time_slot_id, reason, notes)
    VALUES (
      p_school_id,
      (add_item->>'date')::DATE,
      CASE WHEN add_item->'time_slot_id' IS NULL OR add_item->>'time_slot_id' IS NULL THEN NULL
           ELSE (add_item->>'time_slot_id')::UUID END,
      NULLIF(TRIM(add_item->>'reason'), ''),
      NULLIF(TRIM(add_item->>'notes'), '')
    )
    RETURNING school_closures.id, school_closures.school_id, school_closures.date,
              school_closures.time_slot_id, school_closures.reason, school_closures.notes,
              school_closures.created_at
    INTO rec;
    id := rec.id;
    school_id := rec.school_id;
    date := rec.date;
    time_slot_id := rec.time_slot_id;
    reason := rec.reason;
    notes := rec.notes;
    created_at := rec.created_at;
    RETURN NEXT;
  END LOOP;

  -- Range adds (whole-day only; skip dates that already have a whole-day closure)
  FOR range_item IN SELECT * FROM jsonb_array_elements(p_add_ranges)
  LOOP
    start_d := (range_item->>'start_date')::DATE;
    end_d := (range_item->>'end_date')::DATE;
    range_reason := NULLIF(TRIM(range_item->>'reason'), '');
    range_notes := NULLIF(TRIM(range_item->>'notes'), '');

    IF start_d > end_d THEN
      RAISE EXCEPTION 'start_date must be on or before end_date'
        USING ERRCODE = '22000';
    END IF;

    day_count := (end_d - start_d) + 1;
    IF day_count > 365 THEN
      RAISE EXCEPTION 'Date range cannot exceed 365 days'
        USING ERRCODE = '22000';
    END IF;

    d := start_d;
    WHILE d <= end_d
    LOOP
      BEGIN
        INSERT INTO school_closures (school_id, date, time_slot_id, reason, notes)
        VALUES (p_school_id, d, NULL, range_reason, range_notes)
        RETURNING school_closures.id, school_closures.school_id, school_closures.date,
                  school_closures.time_slot_id, school_closures.reason, school_closures.notes,
                  school_closures.created_at
        INTO rec;
        id := rec.id;
        school_id := rec.school_id;
        date := rec.date;
        time_slot_id := rec.time_slot_id;
        reason := rec.reason;
        notes := rec.notes;
        created_at := rec.created_at;
        RETURN NEXT;
      EXCEPTION
        WHEN unique_violation THEN
          NULL; -- skip existing whole-day closure
      END;
      d := d + 1;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION apply_school_closure_changes IS 'Atomically delete and add school closures in one transaction. Used when editing closure shape (e.g. whole day to specific slots).';
