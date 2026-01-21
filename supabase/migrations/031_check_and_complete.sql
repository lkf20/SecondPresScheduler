-- Check what exists and complete the migration if needed
-- Run this if you get "relation already exists" errors

-- ============================================================================
-- 1. Check what tables exist
-- ============================================================================
SELECT 
  table_name,
  CASE WHEN table_name IN (
    'coverage_requests',
    'coverage_request_shifts', 
    'substitute_contacts',
    'sub_contact_shift_overrides'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'coverage_requests',
    'coverage_request_shifts',
    'substitute_contacts', 
    'sub_contact_shift_overrides'
  )
ORDER BY table_name;

-- ============================================================================
-- 2. Check if coverage_request_id column exists on time_off_requests
-- ============================================================================
SELECT 
  column_name,
  data_type,
  CASE WHEN column_name = 'coverage_request_id' THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'time_off_requests'
  AND column_name = 'coverage_request_id';

-- ============================================================================
-- 3. Check if triggers exist
-- ============================================================================
SELECT 
  trigger_name,
  event_object_table,
  CASE WHEN trigger_name IN (
    'trigger_update_total_shifts_on_shift_change',
    'trigger_update_covered_shifts_on_assignment',
    'trigger_update_status_from_counters',
    'trigger_update_substitute_contact_timestamps',
    'trigger_update_shift_override_timestamp'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trigger_update_total_shifts_on_shift_change',
    'trigger_update_covered_shifts_on_assignment',
    'trigger_update_status_from_counters',
    'trigger_update_substitute_contact_timestamps',
    'trigger_update_shift_override_timestamp'
  )
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 4. Check if Unknown classroom exists
-- ============================================================================
SELECT 
  id,
  name,
  "order",
  is_active,
  CASE WHEN name = 'Unknown (needs review)' THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM classrooms
WHERE name = 'Unknown (needs review)';


