#!/bin/bash
# Test script to verify school_id migration
# Run with: bash scripts/test-school-id-migration.sh

set -e

echo "🧪 Testing school_id migration..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found"
  echo "   Please create .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
  echo "❌ Error: Supabase CLI not found"
  echo "   Please install it: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "📋 Running database checks via Supabase SQL..."
echo ""

# Create a temporary SQL file for testing
cat > /tmp/test_school_id.sql << 'EOF'
-- Test 1: Check school_id columns exist
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY['classrooms', 'time_slots', 'class_groups', 'teacher_schedules', 'staffing_rules', 'schedule_cells', 'schedule_settings'];
  column_exists BOOLEAN;
BEGIN
  RAISE NOTICE '=== Test 1: Checking school_id columns exist ===';
  FOREACH table_name IN ARRAY tables
  LOOP
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = table_name
      AND column_name = 'school_id'
    ) INTO column_exists;
    
    IF column_exists THEN
      RAISE NOTICE '✓ % has school_id column', table_name;
    ELSE
      RAISE NOTICE '✗ % missing school_id column', table_name;
    END IF;
  END LOOP;
END $$;

-- Test 2: Check school_id columns are NOT NULL
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY['classrooms', 'time_slots', 'class_groups', 'teacher_schedules', 'staffing_rules', 'schedule_cells', 'schedule_settings'];
  has_null BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 2: Checking school_id columns are NOT NULL ===';
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE school_id IS NULL)', table_name) INTO has_null;
    
    IF NOT has_null THEN
      RAISE NOTICE '✓ % has no NULL school_id values', table_name;
    ELSE
      RAISE NOTICE '✗ % has NULL school_id values', table_name;
    END IF;
  END LOOP;
END $$;

-- Test 3: Check data exists
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY['classrooms', 'time_slots', 'class_groups', 'teacher_schedules', 'staffing_rules', 'schedule_cells', 'schedule_settings'];
  row_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 3: Checking table data ===';
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
    
    IF row_count > 0 THEN
      RAISE NOTICE '✓ % has % rows', table_name, row_count;
    ELSE
      RAISE NOTICE '✗ % has no data', table_name;
    END IF;
  END LOOP;
END $$;

-- Test 4: Check default school_id
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY['classrooms', 'time_slots', 'class_groups', 'teacher_schedules', 'staffing_rules', 'schedule_cells', 'schedule_settings'];
  total_count INTEGER;
  default_count INTEGER;
  default_school_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 4: Checking default school_id usage ===';
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO total_count;
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE school_id = $1', table_name) USING default_school_id INTO default_count;
    
    IF total_count = default_count THEN
      RAISE NOTICE '✓ %: All % rows use default school_id', table_name, total_count;
    ELSE
      RAISE NOTICE '✗ %: Only %/% rows use default school_id', table_name, default_count, total_count;
    END IF;
  END LOOP;
END $$;

-- Test 5: Check unique constraints
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 5: Checking unique constraints ===';
  
  -- Check classrooms unique constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'classrooms_name_school_id_unique'
  ) THEN
    RAISE NOTICE '✓ classrooms (name, school_id) unique constraint exists';
  ELSE
    RAISE NOTICE '✗ classrooms (name, school_id) unique constraint missing';
  END IF;
  
  -- Check time_slots unique constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'time_slots_code_school_id_unique'
  ) THEN
    RAISE NOTICE '✓ time_slots (code, school_id) unique constraint exists';
  ELSE
    RAISE NOTICE '✗ time_slots (code, school_id) unique constraint missing';
  END IF;
  
  -- Check class_groups unique constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'class_groups_name_school_id_unique'
  ) THEN
    RAISE NOTICE '✓ class_groups (name, school_id) unique constraint exists';
  ELSE
    RAISE NOTICE '✗ class_groups (name, school_id) unique constraint missing';
  END IF;
END $$;

-- Test 6: Check profiles table
DO $$
DECLARE
  has_school_id BOOLEAN;
  profiles_with_school_id INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 6: Checking profiles table ===';
  
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles'
    AND column_name = 'school_id'
  ) INTO has_school_id;
  
  IF has_school_id THEN
    RAISE NOTICE '✓ profiles has school_id column';
    SELECT COUNT(*) INTO profiles_with_school_id FROM profiles WHERE school_id IS NOT NULL;
    RAISE NOTICE '  % profiles have school_id', profiles_with_school_id;
  ELSE
    RAISE NOTICE '✗ profiles missing school_id column';
  END IF;
END $$;

RAISE NOTICE '';
RAISE NOTICE '=== Tests Complete ===';
EOF

# Run the SQL test
cd "$(dirname "$0")/.."
supabase db execute --file /tmp/test_school_id.sql 2>&1 | grep -E "(NOTICE|ERROR|✓|✗)" || {
  echo "❌ Error running tests. Make sure you're connected to Supabase."
  echo "   Try: supabase link --project-ref YOUR_PROJECT_REF"
  exit 1
}

# Cleanup
rm -f /tmp/test_school_id.sql

echo ""
echo "✅ Test script completed!"
echo ""
echo "Next steps:"
echo "  1. Review the test results above"
echo "  2. Test the application manually:"
echo "     - Weekly Schedule page"
echo "     - Baseline Schedule page"
echo "     - Dashboard page"
echo "     - Other key pages"
echo "  3. Verify data is filtered correctly by school_id"
