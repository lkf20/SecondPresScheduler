-- Atomically create staff + role assignments in one transaction.
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
    is_teacher,
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
    COALESCE((p_staff->>'is_teacher')::BOOLEAN, FALSE),
    COALESCE((p_staff->>'is_sub')::BOOLEAN, FALSE),
    COALESCE((p_staff->>'active')::BOOLEAN, TRUE),
    v_school_id
  )
  RETURNING * INTO v_staff;

  PERFORM set_staff_role_assignments_atomic(v_staff.id, p_role_type_ids, v_staff.school_id);

  RETURN v_staff;
END;
$$;
