-- Migration 049: Fix coverage_requests duplicates and classroom lookup
-- This migration:
-- 1. Prevents duplicate coverage_requests for the same source_request_id
-- 2. Fixes classroom lookup to filter by school_id
-- 3. Ensures "Unknown (needs review)" classroom exists per school

-- ============================================================================
-- 1. Update auto_create_coverage_request_from_time_off to check for existing requests
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_create_coverage_request_from_time_off()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_school_id UUID;
  v_existing_id UUID;
BEGIN
  -- Only create if coverage_request_id is not already set
  IF NEW.coverage_request_id IS NULL THEN
    -- Check if a coverage_request already exists for this source_request_id
    SELECT id INTO v_existing_id
    FROM coverage_requests
    WHERE request_type = 'time_off'
      AND source_request_id = NEW.id
    LIMIT 1;
    
    -- If exists, link to it instead of creating a new one
    IF v_existing_id IS NOT NULL THEN
      NEW.coverage_request_id := v_existing_id;
      RETURN NEW;
    END IF;
    
    -- Get school_id for the teacher
    -- Try to get from profile first (most reliable)
    -- teacher_id is staff.id which references auth.users(id), so we can query profiles directly
    SELECT p.school_id INTO v_school_id
    FROM profiles p
    WHERE p.user_id = NEW.teacher_id
    LIMIT 1;
    
    -- Fall back to teacher_schedules if no profile
    IF v_school_id IS NULL THEN
      SELECT ts.school_id INTO v_school_id
      FROM teacher_schedules ts
      WHERE ts.teacher_id = NEW.teacher_id
      GROUP BY ts.school_id
      ORDER BY COUNT(*) DESC
      LIMIT 1;
    END IF;
    
    -- Default to the default school if nothing found
    IF v_school_id IS NULL THEN
      SELECT id INTO v_school_id
      FROM schools
      WHERE id = '00000000-0000-0000-0000-000000000001'
      LIMIT 1;
    END IF;
    
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
      school_id,
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
      v_school_id,
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

-- ============================================================================
-- 2. Update auto_create_coverage_request_shift_from_time_off_shift to fix classroom lookup
-- ============================================================================
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
    
    -- Determine classroom_id
    -- Try to get from teacher_schedules first, filtering by school_id
    SELECT ts.classroom_id INTO v_classroom_id
    FROM teacher_schedules ts
    JOIN time_off_requests tor ON ts.teacher_id = tor.teacher_id
    WHERE tor.id = NEW.time_off_request_id
      AND ts.day_of_week_id = NEW.day_of_week_id
      AND ts.time_slot_id = NEW.time_slot_id
      AND ts.school_id = v_school_id
    LIMIT 1;

    -- Fallback to Unknown classroom in the same school if not found
    IF v_classroom_id IS NULL THEN
      -- First try to find "Unknown (needs review)" in the same school
      SELECT id INTO v_classroom_id
      FROM classrooms
      WHERE name = 'Unknown (needs review)'
        AND (school_id = v_school_id OR school_id IS NULL)
      ORDER BY CASE WHEN school_id = v_school_id THEN 0 ELSE 1 END
      LIMIT 1;
      
      -- If still not found, create it for this school
      IF v_classroom_id IS NULL THEN
        INSERT INTO classrooms (name, capacity, is_active, "order", school_id, created_at, updated_at)
        VALUES ('Unknown (needs review)', NULL, true, -1, v_school_id, NOW(), NOW())
        ON CONFLICT (name, school_id) DO NOTHING
        RETURNING id INTO v_classroom_id;
        
        -- If insert failed due to conflict, try to get it again
        IF v_classroom_id IS NULL THEN
          SELECT id INTO v_classroom_id
          FROM classrooms
          WHERE name = 'Unknown (needs review)'
            AND school_id = v_school_id
          LIMIT 1;
        END IF;
      END IF;
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
      school_id,
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
      v_school_id,
      NEW.created_at
    )
    ON CONFLICT (id) DO NOTHING; -- Don't error if already exists
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
