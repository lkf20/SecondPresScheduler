-- Migration: Auto-create coverage_requests when time_off_requests are created
-- This ensures backward compatibility - existing API code continues to work
-- while automatically creating the new coverage_requests structure

-- ============================================================================
-- 1. Function to auto-create coverage_request when time_off_request is created
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_create_coverage_request_from_time_off()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
BEGIN
  -- Only create if coverage_request_id is not already set
  IF NEW.coverage_request_id IS NULL THEN
    -- Create the coverage_request
    INSERT INTO coverage_requests (
      request_type,
      source_request_id,
      teacher_id,
      start_date,
      end_date,
      status,
      total_shifts, -- Will be 0 initially, updated when shifts are added
      covered_shifts, -- Will be 0 initially
      created_at,
      updated_at
    )
    VALUES (
      'time_off',
      NEW.id,
      NEW.teacher_id,
      NEW.start_date,
      NEW.end_date,
      'open', -- Default to open
      0, -- No shifts yet
      0, -- No coverage yet
      NEW.created_at,
      NEW.updated_at
    )
    RETURNING id INTO v_coverage_request_id;

    -- Link the time_off_request to the coverage_request
    NEW.coverage_request_id := v_coverage_request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_create_coverage_request ON time_off_requests;
CREATE TRIGGER trigger_auto_create_coverage_request
  BEFORE INSERT ON time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_coverage_request_from_time_off();

-- ============================================================================
-- 2. Function to auto-create coverage_request_shifts when time_off_shifts are created
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_create_coverage_request_shift_from_time_off_shift()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_classroom_id UUID;
BEGIN
  -- Get the coverage_request_id from the time_off_request
  SELECT coverage_request_id INTO v_coverage_request_id
  FROM time_off_requests
  WHERE id = NEW.time_off_request_id;

  -- Only proceed if we have a coverage_request
  IF v_coverage_request_id IS NOT NULL THEN
    -- Determine classroom_id
    -- Try to get from teacher_schedules first
    SELECT ts.classroom_id INTO v_classroom_id
    FROM teacher_schedules ts
    JOIN time_off_requests tor ON ts.teacher_id = tor.teacher_id
    WHERE tor.id = NEW.time_off_request_id
      AND ts.day_of_week_id = NEW.day_of_week_id
      AND ts.time_slot_id = NEW.time_slot_id
    LIMIT 1;

    -- Fallback to Unknown classroom if not found
    IF v_classroom_id IS NULL THEN
      SELECT id INTO v_classroom_id
      FROM classrooms
      WHERE name = 'Unknown (needs review)'
      LIMIT 1;
    END IF;

    -- Create the coverage_request_shift
    -- Use the same ID as time_off_shift to maintain referential integrity
    INSERT INTO coverage_request_shifts (
      id,
      coverage_request_id,
      date,
      day_of_week_id,
      time_slot_id,
      classroom_id,
      class_group_id, -- Will be NULL for now
      is_partial,
      start_time,
      end_time,
      created_at
    )
    VALUES (
      NEW.id, -- Use same ID
      v_coverage_request_id,
      NEW.date,
      NEW.day_of_week_id,
      NEW.time_slot_id,
      v_classroom_id,
      NULL, -- class_group_id not available from time_off_shifts
      NEW.is_partial,
      NEW.start_time,
      NEW.end_time,
      NEW.created_at
    )
    ON CONFLICT (id) DO NOTHING; -- Don't error if already exists
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_create_coverage_request_shift ON time_off_shifts;
CREATE TRIGGER trigger_auto_create_coverage_request_shift
  AFTER INSERT ON time_off_shifts
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_coverage_request_shift_from_time_off_shift();

-- ============================================================================
-- 3. Function to update coverage_request_shifts when time_off_shifts are updated
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_update_coverage_request_shift_from_time_off_shift()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
BEGIN
  -- Get the coverage_request_id from the time_off_request
  SELECT coverage_request_id INTO v_coverage_request_id
  FROM time_off_requests
  WHERE id = COALESCE(NEW.time_off_request_id, OLD.time_off_request_id);

  -- Only proceed if we have a coverage_request
  IF v_coverage_request_id IS NOT NULL THEN
    -- Update the coverage_request_shift
    UPDATE coverage_request_shifts
    SET
      date = NEW.date,
      day_of_week_id = NEW.day_of_week_id,
      time_slot_id = NEW.time_slot_id,
      is_partial = NEW.is_partial,
      start_time = NEW.start_time,
      end_time = NEW.end_time
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_update_coverage_request_shift ON time_off_shifts;
CREATE TRIGGER trigger_auto_update_coverage_request_shift
  AFTER UPDATE ON time_off_shifts
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_coverage_request_shift_from_time_off_shift();

-- ============================================================================
-- 4. Function to delete coverage_request_shifts when time_off_shifts are deleted
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_delete_coverage_request_shift_from_time_off_shift()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the corresponding coverage_request_shift
  -- The trigger on coverage_request_shifts will handle updating total_shifts counter
  DELETE FROM coverage_request_shifts
  WHERE id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_delete_coverage_request_shift ON time_off_shifts;
CREATE TRIGGER trigger_auto_delete_coverage_request_shift
  AFTER DELETE ON time_off_shifts
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_coverage_request_shift_from_time_off_shift();

