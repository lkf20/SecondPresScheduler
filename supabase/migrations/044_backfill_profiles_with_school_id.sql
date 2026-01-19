-- Migration 044: Backfill profiles with school_id
-- Ensures all auth.users have a profile with a valid school_id

-- Step 1: Ensure we have at least one school
-- Use existing school if it exists, otherwise create a new one
DO $$
DECLARE
  default_school_id UUID;
  default_school_name TEXT := 'Second Presbyterian Weekday School';
BEGIN
  -- Try to get existing school (from migration 034)
  SELECT id INTO default_school_id
  FROM schools
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- If no school exists, create a new one
  IF default_school_id IS NULL THEN
    INSERT INTO schools (name)
    VALUES (default_school_name)
    RETURNING id INTO default_school_id;
  END IF;

  -- Step 2: Backfill profiles for all auth.users without profiles
  INSERT INTO profiles (user_id, school_id, role)
  SELECT 
    au.id,
    default_school_id,
    'director' -- Default role
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = au.id
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Step 3: Ensure all existing profiles have a school_id
  -- Update any profiles with NULL school_id (shouldn't happen due to NOT NULL constraint, but be safe)
  UPDATE profiles
  SET school_id = default_school_id
  WHERE school_id IS NULL;

  RAISE NOTICE 'Backfilled profiles with school_id: %', default_school_id;
END $$;

-- Verify: Check that all auth.users have profiles
DO $$
DECLARE
  users_without_profiles INTEGER;
  profiles_without_school INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_without_profiles
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = au.id
  );

  SELECT COUNT(*) INTO profiles_without_school
  FROM profiles
  WHERE school_id IS NULL;

  IF users_without_profiles > 0 THEN
    RAISE WARNING 'Found % users without profiles', users_without_profiles;
  END IF;

  IF profiles_without_school > 0 THEN
    RAISE WARNING 'Found % profiles without school_id', profiles_without_school;
  END IF;
END $$;
