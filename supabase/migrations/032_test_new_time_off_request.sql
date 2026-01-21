-- Quick Test: Verify New Time Off Request Created Coverage Request
-- Run these queries after creating a time off request to verify everything worked

-- ============================================================================
-- 1. Check the most recent time_off_request and its coverage_request
-- ============================================================================
SELECT 
  tor.id as time_off_request_id,
  tor.teacher_id,
  s.first_name || ' ' || s.last_name as teacher_name,
  tor.start_date,
  tor.end_date,
  tor.coverage_request_id,
  cr.id as coverage_request_id,
  cr.request_type,
  cr.status,
  cr.total_shifts,
  cr.covered_shifts,
  (SELECT COUNT(*) FROM coverage_request_shifts WHERE coverage_request_id = cr.id) as actual_shifts_count,
  (SELECT COUNT(*) FROM time_off_shifts WHERE time_off_request_id = tor.id) as time_off_shifts_count
FROM time_off_requests tor
LEFT JOIN coverage_requests cr ON tor.coverage_request_id = cr.id
LEFT JOIN staff s ON tor.teacher_id = s.id
ORDER BY tor.created_at DESC
LIMIT 1;

-- Expected Results:
-- ✅ coverage_request_id should NOT be null
-- ✅ total_shifts should match actual_shifts_count
-- ✅ total_shifts should match time_off_shifts_count
-- ✅ status should be 'open' (unless all shifts are already covered)

-- ============================================================================
-- 2. Check coverage_request_shifts for the most recent request
-- ============================================================================
SELECT 
  crs.id,
  crs.date,
  ts.code as time_slot_code,
  c.name as classroom_name,
  CASE 
    WHEN c.name = 'Unknown (needs review)' THEN '⚠️ NEEDS REVIEW'
    ELSE '✅ OK'
  END as classroom_status
FROM coverage_request_shifts crs
JOIN coverage_requests cr ON crs.coverage_request_id = cr.id
JOIN time_slots ts ON crs.time_slot_id = ts.id
JOIN classrooms c ON crs.classroom_id = c.id
WHERE cr.id = (
  SELECT cr2.id 
  FROM coverage_requests cr2
  JOIN time_off_requests tor ON cr2.source_request_id = tor.id
  ORDER BY tor.created_at DESC
  LIMIT 1
)
ORDER BY crs.date, ts.code;

-- Expected Results:
-- ✅ All shifts should have a classroom assigned
-- ✅ If any show "⚠️ NEEDS REVIEW", those need manual classroom assignment
-- ✅ Most should show "✅ OK" with actual classroom names

-- ============================================================================
-- 3. Verify counter accuracy for the most recent request
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
   WHERE crs.coverage_request_id = cr.id) as actual_covered,
  CASE 
    WHEN cr.total_shifts = (SELECT COUNT(*) FROM coverage_request_shifts WHERE coverage_request_id = cr.id)
      AND cr.covered_shifts = (SELECT COUNT(DISTINCT crs.id)
        FROM coverage_request_shifts crs
        INNER JOIN sub_assignments sa ON 
          sa.date = crs.date 
          AND sa.time_slot_id = crs.time_slot_id
          AND sa.teacher_id = cr.teacher_id
        WHERE crs.coverage_request_id = cr.id)
    THEN '✅ COUNTERS CORRECT'
    ELSE '❌ COUNTER MISMATCH'
  END as counter_check
FROM coverage_requests cr
WHERE cr.id = (
  SELECT cr2.id 
  FROM coverage_requests cr2
  JOIN time_off_requests tor ON cr2.source_request_id = tor.id
  ORDER BY tor.created_at DESC
  LIMIT 1
);

-- Expected Results:
-- ✅ counter_total should equal actual_total
-- ✅ counter_covered should equal actual_covered
-- ✅ counter_check should show "✅ COUNTERS CORRECT"

-- ============================================================================
-- 4. Verify status computation
-- ============================================================================
SELECT 
  cr.id,
  cr.status as current_status,
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
    END THEN '✅ STATUS CORRECT' 
    ELSE '❌ STATUS MISMATCH' 
  END as status_check
FROM coverage_requests cr
WHERE cr.id = (
  SELECT cr2.id 
  FROM coverage_requests cr2
  JOIN time_off_requests tor ON cr2.source_request_id = tor.id
  ORDER BY tor.created_at DESC
  LIMIT 1
);

-- Expected Results:
-- ✅ computed_status should match current_status
-- ✅ status_check should show "✅ STATUS CORRECT"

-- ============================================================================
-- 5. Summary: Overall system health
-- ============================================================================
SELECT 
  COUNT(*) as total_coverage_requests,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_requests,
  COUNT(CASE WHEN status = 'filled' THEN 1 END) as filled_requests,
  SUM(total_shifts) as total_shifts_needing_coverage,
  SUM(covered_shifts) as total_shifts_covered,
  ROUND(AVG(CASE WHEN total_shifts > 0 THEN covered_shifts::numeric / total_shifts::numeric ELSE 0 END) * 100, 2) as avg_coverage_percent
FROM coverage_requests;

-- Expected Results:
-- ✅ Should show at least 1 total_coverage_requests (your new one)
-- ✅ open_requests should be >= 1 (unless all are filled)
-- ✅ total_shifts_needing_coverage should match the number of shifts in your request


