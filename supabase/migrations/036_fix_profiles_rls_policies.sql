-- Fix RLS policies for profiles table to prevent infinite recursion
-- and allow users to create their own profiles

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view profiles in their school" ON profiles;

-- Add INSERT policy: Users can create their own profile
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
CREATE POLICY "Users can create their own profile" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Simplified SELECT policy: Users can view profiles in their school
-- This avoids recursion by using a security definer function or by checking
-- if the user has a profile first (but only for viewing other profiles)
-- For now, let's keep it simple: users can view their own profile
-- and we'll add a separate policy for viewing school profiles later if needed
-- (This can be done via a security definer function to avoid recursion)

-- The existing "Users can view their own profile" policy is fine and doesn't cause recursion
-- We'll add a non-recursive policy for viewing school profiles using a function

-- Create a security definer function to check school membership without recursion
CREATE OR REPLACE FUNCTION user_belongs_to_school(check_school_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND school_id = check_school_id
  );
END;
$$;

-- Now create a non-recursive policy for viewing profiles in the same school
CREATE POLICY "Users can view profiles in their school" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can always view their own profile (handled by other policy, but included for clarity)
    auth.uid() = user_id
    OR
    -- User can view other profiles in their school (using function to avoid recursion)
    user_belongs_to_school(profiles.school_id)
  );

-- Comment
COMMENT ON FUNCTION user_belongs_to_school IS 'Checks if current user belongs to a school without causing RLS recursion';


