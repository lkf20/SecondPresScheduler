-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table (links auth.users to schools)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'director',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Insert default school
INSERT INTO schools (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Second Presbyterian Weekday School')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schools (read-only for authenticated users)
DROP POLICY IF EXISTS "Users can view schools" ON schools;
CREATE POLICY "Users can view schools" ON schools
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view profiles in their school" ON profiles;
CREATE POLICY "Users can view profiles in their school" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.school_id = profiles.school_id
    )
  );

-- Comment tables
COMMENT ON TABLE schools IS 'Schools/tenants in the system';
COMMENT ON TABLE profiles IS 'Links auth.users to schools with roles';

