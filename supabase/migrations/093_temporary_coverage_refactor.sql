-- Migration: Refactor Temporary Coverage and Drop is_teacher

-- 1. Update staffing_events event_type
-- First, drop the existing check constraint on event_type
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'staffing_events'::regclass 
      AND contype = 'c' 
      AND conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'staffing_events'::regclass AND attname = 'event_type')::smallint]
  ) LOOP
    EXECUTE 'ALTER TABLE staffing_events DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Update existing data
UPDATE staffing_events 
SET event_type = 'temporary_coverage' 
WHERE event_type = 'flex_assignment';

-- Add the new check constraint
ALTER TABLE staffing_events 
ADD CONSTRAINT staffing_events_event_type_check 
CHECK (event_type IN ('temporary_coverage'));


-- 2. Re-create create_staff_with_role_assignments without is_teacher
CREATE OR REPLACE FUNCTION create_staff_with_role_assignments(
  p_staff JSONB,
  p_role_type_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS staff
LANGUAGE plpgsql
AS $$
DECLARE
  v_staff staff%ROWTYPE;
  v_school_id UUID;
BEGIN
  v_school_id := NULLIF(p_staff->>'school_id', '')::UUID;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23502',
      MESSAGE = 'school_id is required to create staff';
  END IF;

  INSERT INTO staff (
    id,
    first_name,
    last_name,
    display_name,
    phone,
    email,
    is_sub,
    active,
    school_id
  )
  VALUES (
    COALESCE(NULLIF(p_staff->>'id', '')::UUID, gen_random_uuid()),
    p_staff->>'first_name',
    p_staff->>'last_name',
    NULLIF(p_staff->>'display_name', ''),
    NULLIF(p_staff->>'phone', ''),
    NULLIF(p_staff->>'email', ''),
    COALESCE((p_staff->>'is_sub')::BOOLEAN, FALSE),
    COALESCE((p_staff->>'active')::BOOLEAN, TRUE),
    v_school_id
  )
  RETURNING * INTO v_staff;

  PERFORM set_staff_role_assignments_atomic(v_staff.id, p_role_type_ids, v_staff.school_id);

  RETURN v_staff;
END;
$$;


-- 3. Re-create update_staff_with_role_assignments without is_teacher
CREATE OR REPLACE FUNCTION update_staff_with_role_assignments(
  p_staff_id UUID,
  p_updates JSONB,
  p_role_type_ids UUID[] DEFAULT NULL
)
RETURNS staff
LANGUAGE plpgsql
AS $$
DECLARE
  v_staff staff%ROWTYPE;
BEGIN
  UPDATE staff s
  SET
    first_name = CASE WHEN p_updates ? 'first_name' THEN p_updates->>'first_name' ELSE s.first_name END,
    last_name = CASE WHEN p_updates ? 'last_name' THEN p_updates->>'last_name' ELSE s.last_name END,
    display_name = CASE WHEN p_updates ? 'display_name' THEN NULLIF(p_updates->>'display_name', '') ELSE s.display_name END,
    phone = CASE WHEN p_updates ? 'phone' THEN NULLIF(p_updates->>'phone', '') ELSE s.phone END,
    email = CASE WHEN p_updates ? 'email' THEN NULLIF(p_updates->>'email', '') ELSE s.email END,
    active = CASE WHEN p_updates ? 'active' THEN (p_updates->>'active')::BOOLEAN ELSE s.active END,
    is_sub = CASE WHEN p_updates ? 'is_sub' THEN (p_updates->>'is_sub')::BOOLEAN ELSE s.is_sub END,
    updated_at = NOW()
  WHERE s.id = p_staff_id
  RETURNING * INTO v_staff;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Staff member not found';
  END IF;

  IF p_role_type_ids IS NOT NULL THEN
    PERFORM set_staff_role_assignments_atomic(v_staff.id, p_role_type_ids, v_staff.school_id);
  END IF;

  RETURN v_staff;
END;
$$;


-- 4. Drop is_teacher from staff table
ALTER TABLE staff DROP COLUMN IF EXISTS is_teacher;
