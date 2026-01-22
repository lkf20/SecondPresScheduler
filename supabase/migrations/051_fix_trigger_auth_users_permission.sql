-- Migration 051: Fix trigger function to avoid accessing auth.users table directly
-- This fixes "permission denied for table users" error
-- The trigger was trying to JOIN auth.users which requires special permissions
-- Since teacher_id (staff.id) = user_id, we can query profiles directly

-- ============================================================================
-- Update auto_create_coverage_request_from_time_off to avoid auth.users JOIN
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
