-- Test Script for Coverage Requests Migration
-- Run these queries to verify the migration worked correctly

-- ============================================================================
-- 1. Verify Unknown classroom was created
-- ============================================================================
SELECT 
  id,
  name,
  "order",
  is_active,
  created_at
FROM classrooms 
WHERE name = 'Unknown (needs review)';

-- Expected: 1 row with name 'Unknown (needs review)', order = -1

-- ============================================================================
-- 2. Check if existing time_off_requests were migrated
-- ============================================================================
SELECT 
  tor.id as time_off_request_id,
  tor.teacher_id,
  tor.start_date,
  tor.end_date,
  tor.coverage_request_id,
  cr.id as coverage_request_id,
  cr.request_type,
  cr.status,
  cr.total_shifts,
  cr.covered_shifts,
  (SELECT COUNT(*) FROM coverage_request_shifts WHERE coverage_request_id = cr.id) as actual_shifts_count
FROM time_off_requests tor
LEFT JOIN coverage_requests cr ON tor.coverage_request_id = cr.id
ORDER BY tor.created_at DESC
LIMIT 10;

-- Expected: All time_off_requests should have a coverage_request_id
-- total_shifts should match the count of coverage_request_shifts

-- ============================================================================
-- 3. Verify coverage_request_shifts were created correctly
-- ============================================================================
SELECT 
  crs.id,
  crs.coverage_request_id,
  crs.date,
  crs.time_slot_id,
  crs.classroom_id,
  c.name as classroom_name,
  crs.class_group_id,
  cr.teacher_id,
  s.first_name || ' ' || s.last_name as teacher_name
FROM coverage_request_shifts crs
JOIN coverage_requests cr ON crs.coverage_request_id = cr.id
JOIN staff s ON cr.teacher_id = s.id
LEFT JOIN classrooms c ON crs.classroom_id = c.id
ORDER BY crs.created_at DESC
LIMIT 20;

-- Expected: All shifts should have a classroom_id (either from teacher_schedules or "Unknown")
-- Check if any have "Unknown (needs review)" - these need manual review

-- ============================================================================
-- 4. Test counter accuracy
-- ============================================================================
SELECT 
  cr.id,
  cr.status,
  cr.total_shifts as counter_total,
  cr.covered_shifts as counter_covered,
  (SELECT COUNT(*) FROM coverage_request_shifts WHERE coverage_request_id = cr.id) as actual_total,
  (SELECT COUNT(DISTINCT crs.id)
   FROM coverage_request_shifts crs
   INNER JOIN sub_assignments sa ON 
     sa.date = crs.date 
     AND sa.time_slot_id = crs.time_slot_id
     AND sa.teacher_id = cr.teacher_id
   WHERE crs.coverage_request_id = cr.id) as actual_covered
FROM coverage_requests cr
ORDER BY cr.created_at DESC
LIMIT 10;

-- Expected: counter_total should match actual_total
-- Expected: counter_covered should match actual_covered
-- Expected: status should be 'filled' if counter_covered = counter_total, 'open' otherwise

-- ============================================================================
-- 5. Check for shifts assigned to Unknown classroom
-- ============================================================================
SELECT 
  crs.id,
  crs.date,
  crs.time_slot_id,
  ts.code as time_slot_code,
  cr.teacher_id,
  s.first_name || ' ' || s.last_name as teacher_name,
  c.name as classroom_name
FROM coverage_request_shifts crs
JOIN coverage_requests cr ON crs.coverage_request_id = cr.id
JOIN staff s ON cr.teacher_id = s.id
JOIN classrooms c ON crs.classroom_id = c.id
JOIN time_slots ts ON crs.time_slot_id = ts.id
WHERE c.name = 'Unknown (needs review)'
ORDER BY crs.date DESC;

-- Expected: List of shifts that need manual review to assign correct classroom
-- These are shifts where we couldn't determine the classroom from teacher_schedules

-- ============================================================================
-- 6. Verify triggers are working (test by checking recent requests)
-- ============================================================================
-- Check status computation for recent requests
-- To test triggers manually:
--   a) Add a new shift (should increment total_shifts)
--   b) Add a sub_assignment (should increment covered_shifts)
--   c) Remove a shift (should decrement total_shifts)
--   d) Remove a sub_assignment (should decrement covered_shifts)

-- Check status computation for all requests
SELECT 
  cr.id,
  cr.status,
  cr.total_shifts,
  cr.covered_shifts,
  CASE 
    WHEN cr.covered_shifts = cr.total_shifts AND cr.total_shifts > 0 THEN 'filled'
    WHEN cr.total_shifts = 0 THEN 'open'
    ELSE 'open'
  END as computed_status,
  CASE 
    WHEN cr.status = CASE 
      WHEN cr.covered_shifts = cr.total_shifts AND cr.total_shifts > 0 THEN 'filled'
      WHEN cr.total_shifts = 0 THEN 'open'
      ELSE 'open'
    END THEN '✅ CORRECT' 
    ELSE '❌ MISMATCH' 
  END as status_check
FROM coverage_requests cr
ORDER BY cr.created_at DESC
LIMIT 10;

-- ============================================================================
-- 7. Summary statistics
-- ============================================================================
SELECT 
  COUNT(*) as total_coverage_requests,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_requests,
  COUNT(CASE WHEN status = 'filled' THEN 1 END) as filled_requests,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_requests,
  SUM(total_shifts) as total_shifts_needing_coverage,
  SUM(covered_shifts) as total_shifts_covered,
  ROUND(AVG(CASE WHEN total_shifts > 0 THEN covered_shifts::numeric / total_shifts::numeric ELSE 0 END) * 100, 2) as avg_coverage_percent
FROM coverage_requests;

-- Expected: Summary of all coverage requests and their status

