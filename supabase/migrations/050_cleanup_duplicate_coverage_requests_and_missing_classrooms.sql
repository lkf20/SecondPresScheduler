-- Migration 050: Cleanup duplicate coverage_requests and fix missing classrooms
-- This migration:
-- 1. Removes duplicate coverage_requests (keeps the most recent one)
-- 2. Fixes coverage_request_shifts with missing or NULL classroom_id
-- 3. Ensures all shifts have valid classroom_id

-- ============================================================================
-- 1. Fix duplicate coverage_requests for the same source_request_id
-- ============================================================================
DO $$
DECLARE
  duplicate_record RECORD;
  keep_id UUID;
  delete_ids UUID[];
BEGIN
  -- Find all duplicate coverage_requests grouped by source_request_id
  FOR duplicate_record IN
    SELECT 
      source_request_id,
      array_agg(id ORDER BY created_at DESC) as ids,
      COUNT(*) as count
    FROM coverage_requests
    WHERE request_type = 'time_off'
      AND source_request_id IS NOT NULL
    GROUP BY source_request_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recent one (first in the array since we ordered DESC)
    keep_id := duplicate_record.ids[1];
    -- Delete the rest
    delete_ids := duplicate_record.ids[2:array_length(duplicate_record.ids, 1)];
    
    -- Update time_off_requests to point to the kept coverage_request
    UPDATE time_off_requests
    SET coverage_request_id = keep_id
    WHERE coverage_request_id = ANY(delete_ids);
    
    -- Move shifts from duplicates to the kept coverage_request
    UPDATE coverage_request_shifts
    SET coverage_request_id = keep_id
    WHERE coverage_request_id = ANY(delete_ids);
    
    -- Delete the duplicate coverage_requests (cascade will handle any remaining shifts)
    DELETE FROM coverage_requests
    WHERE id = ANY(delete_ids);
    
    RAISE NOTICE 'Merged % duplicate coverage_requests for source_request_id %, kept: %, deleted: %', 
      duplicate_record.count, duplicate_record.source_request_id, keep_id, delete_ids;
  END LOOP;
  
  -- Also check for duplicates that might have been missed (same teacher, same dates, same source_request_id)
  -- This handles edge cases where source_request_id might be slightly different
  FOR duplicate_record IN
    SELECT 
      cr1.source_request_id,
      array_agg(cr1.id ORDER BY cr1.created_at DESC) as ids,
      COUNT(*) as count
    FROM coverage_requests cr1
    WHERE cr1.request_type = 'time_off'
      AND cr1.source_request_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM coverage_requests cr2
        WHERE cr2.request_type = 'time_off'
          AND cr2.source_request_id = cr1.source_request_id
          AND cr2.id != cr1.id
      )
    GROUP BY cr1.source_request_id
    HAVING COUNT(*) > 1
  LOOP
    keep_id := duplicate_record.ids[1];
    delete_ids := duplicate_record.ids[2:array_length(duplicate_record.ids, 1)];
    
    -- Update time_off_requests to point to the kept coverage_request
    UPDATE time_off_requests
    SET coverage_request_id = keep_id
    WHERE coverage_request_id = ANY(delete_ids);
    
    -- Move shifts from duplicates to the kept coverage_request
    UPDATE coverage_request_shifts
    SET coverage_request_id = keep_id
    WHERE coverage_request_id = ANY(delete_ids);
    
    -- Delete the duplicate coverage_requests
    DELETE FROM coverage_requests
    WHERE id = ANY(delete_ids);
    
    RAISE NOTICE 'Merged additional % duplicate coverage_requests for source_request_id %, kept: %, deleted: %', 
      duplicate_record.count, duplicate_record.source_request_id, keep_id, delete_ids;
  END LOOP;
END $$;

-- ============================================================================
-- 2. Fix coverage_request_shifts with missing classroom_id
-- ============================================================================
DO $$
DECLARE
  shift_record RECORD;
  v_classroom_id UUID;
  v_school_id UUID;
  fixed_count INTEGER := 0;
BEGIN
  -- Find all shifts with NULL or invalid classroom_id
  FOR shift_record IN
    SELECT 
      crs.id,
      crs.coverage_request_id,
      crs.date,
      crs.day_of_week_id,
      crs.time_slot_id,
      crs.classroom_id,
      cr.school_id,
      cr.teacher_id
    FROM coverage_request_shifts crs
    JOIN coverage_requests cr ON crs.coverage_request_id = cr.id
    WHERE crs.classroom_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM classrooms c 
         WHERE c.id = crs.classroom_id
       )
       OR NOT EXISTS (
         SELECT 1 FROM classrooms c 
         WHERE c.id = crs.classroom_id 
         AND c.school_id = cr.school_id
       )
  LOOP
    v_school_id := shift_record.school_id;
    
    -- Try to get classroom from teacher_schedules
    SELECT ts.classroom_id INTO v_classroom_id
    FROM teacher_schedules ts
    WHERE ts.teacher_id = shift_record.teacher_id
      AND ts.day_of_week_id = shift_record.day_of_week_id
      AND ts.time_slot_id = shift_record.time_slot_id
      AND ts.school_id = v_school_id
    LIMIT 1;
    
    -- Fallback to "Unknown (needs review)" in the same school
    IF v_classroom_id IS NULL THEN
      -- Try to find existing "Unknown (needs review)" in the same school
      SELECT id INTO v_classroom_id
      FROM classrooms
      WHERE name = 'Unknown (needs review)'
        AND (school_id = v_school_id OR school_id IS NULL)
      ORDER BY CASE WHEN school_id = v_school_id THEN 0 ELSE 1 END
      LIMIT 1;
      
      -- Create if doesn't exist
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
    
    -- Update the shift with the found/created classroom_id
    IF v_classroom_id IS NOT NULL THEN
      UPDATE coverage_request_shifts
      SET classroom_id = v_classroom_id
      WHERE id = shift_record.id;
      
      fixed_count := fixed_count + 1;
    ELSE
      RAISE WARNING 'Could not find or create classroom for shift %', shift_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Fixed % coverage_request_shifts with missing classroom_id', fixed_count;
END $$;

-- ============================================================================
-- 3. Verify all shifts have valid classroom_id
-- ============================================================================
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM coverage_request_shifts crs
  WHERE crs.classroom_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM classrooms c 
       WHERE c.id = crs.classroom_id
     );
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Still have % coverage_request_shifts with invalid classroom_id', invalid_count;
  ELSE
    RAISE NOTICE 'All coverage_request_shifts have valid classroom_id';
  END IF;
END $$;
