-- Add theme column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system' NOT NULL;

-- Add CHECK constraint to ensure theme is one of the valid options
ALTER TABLE profiles
ADD CONSTRAINT profiles_theme_check CHECK (theme IN ('system', 'accented'));

-- Add comment
COMMENT ON COLUMN profiles.theme IS 'User theme preference: system (light) or accented (dark navy sidebar, teal buttons)';
