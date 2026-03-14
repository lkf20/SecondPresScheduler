-- Migration 112: Log when coverage_requests.covered_shifts is capped so bad data or
-- edge cases can be monitored (cap is correct behavior; logging aids debugging).

-- ============================================================================
-- 1. update_coverage_request_total_shifts: RAISE NOTICE when covered_shifts is capped
-- ============================================================================
CREATE OR REPLACE FUNCTION update_coverage_request_total_shifts()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_delta INTEGER;
  v_covered INTEGER;
  v_total INTEGER;
  v_new_total INTEGER;
  v_new_covered INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_coverage_request_id := NEW.coverage_request_id;
    v_delta := 1;
  ELSIF TG_OP = 'DELETE' THEN
    v_coverage_request_id := OLD.coverage_request_id;
    v_delta := -1;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.coverage_request_id != NEW.coverage_request_id THEN
      -- Decrement old: cap covered_shifts so it never exceeds new total_shifts
      SELECT covered_shifts, total_shifts INTO v_covered, v_total
      FROM coverage_requests WHERE id = OLD.coverage_request_id;
      v_new_total := GREATEST(0, v_total - 1);
      v_new_covered := LEAST(v_covered, v_new_total);
      IF v_new_covered < v_covered THEN
        RAISE NOTICE 'coverage_requests cap (total_shifts): id=% covered_shifts % capped to % (total_shifts % -> %)',
          OLD.coverage_request_id, v_covered, v_new_covered, v_total, v_new_total;
      END IF;
      UPDATE coverage_requests
      SET total_shifts = total_shifts - 1,
          covered_shifts = LEAST(covered_shifts, GREATEST(0, total_shifts - 1)),
          updated_at = NOW()
      WHERE id = OLD.coverage_request_id;
      -- Increment new: cap covered_shifts at new total
      SELECT covered_shifts, total_shifts INTO v_covered, v_total
      FROM coverage_requests WHERE id = NEW.coverage_request_id;
      v_new_total := v_total + 1;
      v_new_covered := LEAST(v_covered, v_new_total);
      IF v_new_covered < v_covered THEN
        RAISE NOTICE 'coverage_requests cap (total_shifts): id=% covered_shifts % capped to % (total_shifts % -> %)',
          NEW.coverage_request_id, v_covered, v_new_covered, v_total, v_new_total;
      END IF;
      UPDATE coverage_requests
      SET total_shifts = total_shifts + 1,
          covered_shifts = LEAST(covered_shifts, total_shifts + 1),
          updated_at = NOW()
      WHERE id = NEW.coverage_request_id;
      RETURN NEW;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT covered_shifts, total_shifts INTO v_covered, v_total
  FROM coverage_requests WHERE id = v_coverage_request_id;
  v_new_total := v_total + v_delta;
  v_new_covered := LEAST(v_covered, v_new_total);
  IF v_new_covered < v_covered THEN
    RAISE NOTICE 'coverage_requests cap (total_shifts): id=% covered_shifts % capped to % (total_shifts % -> %)',
      v_coverage_request_id, v_covered, v_new_covered, v_total, v_new_total;
  END IF;

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
-- 2. update_coverage_request_covered_shifts: RAISE NOTICE when covered_shifts is capped
-- ============================================================================
CREATE OR REPLACE FUNCTION update_coverage_request_covered_shifts()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_delta INTEGER;
  v_covered INTEGER;
  v_total INTEGER;
  v_would_be INTEGER;
  v_new_covered INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := 1;
    SELECT crs.coverage_request_id INTO v_coverage_request_id
    FROM coverage_request_shifts crs
    WHERE crs.id = NEW.coverage_request_shift_id;

    IF v_coverage_request_id IS NOT NULL THEN
      SELECT covered_shifts, total_shifts INTO v_covered, v_total
      FROM coverage_requests WHERE id = v_coverage_request_id;
      v_would_be := GREATEST(0, v_covered + v_delta);
      v_new_covered := LEAST(v_total, v_would_be);
      IF v_new_covered < v_would_be THEN
        RAISE NOTICE 'coverage_requests cap (covered_shifts): id=% covered_shifts % would be % capped to % (total_shifts %)',
          v_coverage_request_id, v_covered, v_would_be, v_new_covered, v_total;
      END IF;
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

    -- Decrement old coverage_request (no cap on decrement)
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
      v_delta := 1;
      SELECT covered_shifts, total_shifts INTO v_covered, v_total
      FROM coverage_requests WHERE id = v_coverage_request_id;
      v_would_be := v_covered + v_delta;
      v_new_covered := LEAST(v_total, v_would_be);
      IF v_new_covered < v_would_be THEN
        RAISE NOTICE 'coverage_requests cap (covered_shifts): id=% covered_shifts % would be % capped to % (total_shifts %)',
          v_coverage_request_id, v_covered, v_would_be, v_new_covered, v_total;
      END IF;
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
