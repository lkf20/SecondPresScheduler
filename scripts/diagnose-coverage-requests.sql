-- Diagnostic script to find duplicate coverage requests and missing classrooms
-- Run this to see what's happening in the database

-- 1. Find duplicate coverage_requests
SELECT 
  source_request_id,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at DESC) as coverage_request_ids,
  array_agg(created_at ORDER BY created_at DESC) as created_dates
FROM coverage_requests
WHERE request_type = 'time_off'
  AND source_request_id IS NOT NULL
GROUP BY source_request_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Find coverage_request_shifts with missing or invalid classroom_id
SELECT 
  crs.id as shift_id,
  crs.coverage_request_id,
  crs.classroom_id,
  crs.date,
  crs.time_slot_id,
  cr.id as coverage_request_id,
  cr.teacher_id,
  cr.source_request_id,
  cr.school_id,
  CASE 
    WHEN crs.classroom_id IS NULL THEN 'NULL classroom_id'
    WHEN NOT EXISTS (SELECT 1 FROM classrooms c WHERE c.id = crs.classroom_id) THEN 'Invalid classroom_id (does not exist)'
    WHEN NOT EXISTS (
      SELECT 1 FROM classrooms c 
      WHERE c.id = crs.classroom_id 
      AND c.school_id = cr.school_id
    ) THEN 'Classroom in different school'
    ELSE 'OK'
  END as status
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
ORDER BY crs.created_at DESC
LIMIT 20;

-- 3. Check if "Unknown (needs review)" classroom exists for each school
SELECT 
  s.id as school_id,
  s.name as school_name,
  c.id as classroom_id,
  c.name as classroom_name,
  CASE 
    WHEN c.id IS NULL THEN 'MISSING - needs to be created'
    ELSE 'EXISTS'
  END as status
FROM schools s
LEFT JOIN classrooms c ON c.name = 'Unknown (needs review)' AND c.school_id = s.id
ORDER BY s.name;

-- 4. Find coverage requests that might be showing as duplicates on dashboard
SELECT 
  cr.id,
  cr.source_request_id,
  cr.teacher_id,
  cr.start_date,
  cr.end_date,
  cr.status,
  cr.created_at,
  s.first_name || ' ' || s.last_name as teacher_name,
  (SELECT COUNT(*) FROM coverage_request_shifts WHERE coverage_request_id = cr.id) as shift_count
FROM coverage_requests cr
JOIN staff s ON cr.teacher_id = s.id
WHERE cr.request_type = 'time_off'
  AND cr.source_request_id IS NOT NULL
  AND cr.status IN ('open', 'filled')
ORDER BY cr.source_request_id, cr.created_at DESC;
