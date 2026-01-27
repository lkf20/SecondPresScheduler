-- Make email nullable in staff table
-- This allows staff members to be created without an email address

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE staff 
  ALTER COLUMN email DROP NOT NULL;

-- Note: We keep the UNIQUE constraint, but now NULL values are allowed
-- Multiple NULL values are allowed in UNIQUE columns in PostgreSQL

-- Remove the foreign key constraint on id to auth.users
-- This allows staff to be created without requiring an auth user first
-- The id will be generated as a UUID, and auth users can be linked later if needed

-- Drop the foreign key constraint (constraint name may be auto-generated)
-- We'll try common constraint names
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_id_fkey;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_id_auth_users_id_fkey;

-- Add a default UUID generation for the id column
-- Note: This requires the pgcrypto extension which should already be enabled
ALTER TABLE staff
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
