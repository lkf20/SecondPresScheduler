-- Migration 110: Ensure coverage_requests counters never violate coverage_requests_counters_check
-- When total_shifts is decremented (e.g. shifts removed on time-off edit), covered_shifts can
-- end up > total_shifts. Cap covered_shifts in both triggers so the check always passes.

-- ============================================================================
-- 0. Fix any existing rows that already violate the check (one-time corrective update)
-- ============================================================================
UPDATE coverage_requests
SET covered_shifts = LEAST(covered_shifts, total_shifts),
    updated_at = NOW()
WHERE covered_shifts > total_shifts;

-- ============================================================================
-- 1. update_coverage_request_total_shifts: cap covered_shifts when total_shifts changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_coverage_request_total_shifts()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_delta INTEGER;
BEGIN
  -- Determine coverage_request_id and delta
  IF TG_OP = 'INSERT' THEN
    v_coverage_request_id := NEW.coverage_request_id;
    v_delta := 1;
  ELSIF TG_OP = 'DELETE' THEN
    v_coverage_request_id := OLD.coverage_request_id;
    v_delta := -1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If coverage_request_id changed, update both old and new
    IF OLD.coverage_request_id != NEW.coverage_request_id THEN
      -- Decrement old: cap covered_shifts so it never exceeds new total_shifts
      UPDATE coverage_requests
      SET total_shifts = total_shifts - 1,
          covered_shifts = LEAST(covered_shifts, GREATEST(0, total_shifts - 1)),
          updated_at = NOW()
      WHERE id = OLD.coverage_request_id;
      -- Increment new: cap covered_shifts at new total
      UPDATE coverage_requests
      SET total_shifts = total_shifts + 1,
          covered_shifts = LEAST(covered_shifts, total_shifts + 1),
          updated_at = NOW()
      WHERE id = NEW.coverage_request_id;
      RETURN NEW;
    ELSE
      -- No change to coverage_request_id, no counter update needed
      RETURN NEW;
    END IF;
  END IF;

  -- Update counter and cap covered_shifts so covered_shifts <= total_shifts
  UPDATE coverage_requests
  SET 
    total_shifts = total_shifts + v_delta,
    covered_shifts = LEAST(covered_shifts, total_shifts + v_delta),
    updated_at = NOW()
  WHERE id = v_coverage_request_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. update_coverage_request_covered_shifts: cap at total_shifts when incrementing
-- ============================================================================
CREATE OR REPLACE FUNCTION update_coverage_request_covered_shifts()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_teacher_id UUID;
  v_delta INTEGER;
BEGIN
  -- Get teacher_id and coverage_request_id from the assignment
  IF TG_OP = 'INSERT' THEN
    v_teacher_id := NEW.teacher_id;
    v_delta := 1;
  ELSIF TG_OP = 'DELETE' THEN
    v_teacher_id := OLD.teacher_id;
    v_delta := -1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If teacher_id or date/time_slot changed, need to update both old and new
    IF (OLD.teacher_id != NEW.teacher_id) OR 
       (OLD.date != NEW.date) OR 
       (OLD.time_slot_id != NEW.time_slot_id) THEN
      -- Decrement old coverage_request
      SELECT cr.id INTO v_coverage_request_id
      FROM coverage_request_shifts crs
      JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
      WHERE crs.date = OLD.date
        AND crs.time_slot_id = OLD.time_slot_id
        AND cr.teacher_id = OLD.teacher_id
      LIMIT 1;
      
      IF v_coverage_request_id IS NOT NULL THEN
        UPDATE coverage_requests
        SET covered_shifts = GREATEST(0, covered_shifts - 1),
            updated_at = NOW()
        WHERE id = v_coverage_request_id;
      END IF;
      
      -- Increment new coverage_request (cap at total_shifts)
      SELECT cr.id INTO v_coverage_request_id
      FROM coverage_request_shifts crs
      JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
      WHERE crs.date = NEW.date
        AND crs.time_slot_id = NEW.time_slot_id
        AND cr.teacher_id = NEW.teacher_id
      LIMIT 1;
      
      IF v_coverage_request_id IS NOT NULL THEN
        UPDATE coverage_requests
        SET covered_shifts = LEAST(total_shifts, covered_shifts + 1),
            updated_at = NOW()
        WHERE id = v_coverage_request_id;
      END IF;
      
      RETURN NEW;
    ELSE
      -- No relevant change, no counter update needed
      RETURN NEW;
    END IF;
  END IF;

  -- Find the coverage_request for this assignment
  SELECT cr.id INTO v_coverage_request_id
  FROM coverage_request_shifts crs
  JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
  WHERE crs.date = COALESCE(NEW.date, OLD.date)
    AND crs.time_slot_id = COALESCE(NEW.time_slot_id, OLD.time_slot_id)
    AND cr.teacher_id = v_teacher_id
  LIMIT 1;

  -- Update counter if we found a matching coverage_request; cap at total_shifts
  IF v_coverage_request_id IS NOT NULL THEN
    UPDATE coverage_requests
    SET 
      covered_shifts = LEAST(total_shifts, GREATEST(0, covered_shifts + v_delta)),
      updated_at = NOW()
    WHERE id = v_coverage_request_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
