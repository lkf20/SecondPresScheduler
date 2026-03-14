-- Migration 111: Use coverage_request_shift_id in covered_shifts trigger
-- Resolve coverage_request from the assignment's FK to coverage_request_shifts instead of
-- matching on (date, time_slot_id, teacher_id). This removes ambiguity when the same teacher
-- has multiple coverage requests with a shift on the same (date, time_slot_id) and is more robust.

CREATE OR REPLACE FUNCTION update_coverage_request_covered_shifts()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_delta INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Resolve coverage_request from the shift the assignment points to
    SELECT crs.coverage_request_id INTO v_coverage_request_id
    FROM coverage_request_shifts crs
    WHERE crs.id = NEW.coverage_request_shift_id;

    IF v_coverage_request_id IS NOT NULL THEN
      UPDATE coverage_requests
      SET
        covered_shifts = LEAST(total_shifts, GREATEST(0, covered_shifts + 1)),
        updated_at = NOW()
      WHERE id = v_coverage_request_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT crs.coverage_request_id INTO v_coverage_request_id
    FROM coverage_request_shifts crs
    WHERE crs.id = OLD.coverage_request_shift_id;

    IF v_coverage_request_id IS NOT NULL THEN
      UPDATE coverage_requests
      SET
        covered_shifts = GREATEST(0, covered_shifts - 1),
        updated_at = NOW()
      WHERE id = v_coverage_request_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.coverage_request_shift_id = NEW.coverage_request_shift_id THEN
      RETURN NEW;
    END IF;

    -- Decrement old coverage_request
    SELECT crs.coverage_request_id INTO v_coverage_request_id
    FROM coverage_request_shifts crs
    WHERE crs.id = OLD.coverage_request_shift_id;

    IF v_coverage_request_id IS NOT NULL THEN
      UPDATE coverage_requests
      SET covered_shifts = GREATEST(0, covered_shifts - 1),
          updated_at = NOW()
      WHERE id = v_coverage_request_id;
    END IF;

    -- Increment new coverage_request (cap at total_shifts)
    SELECT crs.coverage_request_id INTO v_coverage_request_id
    FROM coverage_request_shifts crs
    WHERE crs.id = NEW.coverage_request_shift_id;

    IF v_coverage_request_id IS NOT NULL THEN
      UPDATE coverage_requests
      SET covered_shifts = LEAST(total_shifts, covered_shifts + 1),
          updated_at = NOW()
      WHERE id = v_coverage_request_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
