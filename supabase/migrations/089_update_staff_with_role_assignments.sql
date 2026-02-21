-- Atomically update staff + optional role assignments in one transaction.
-- p_role_type_ids:
-- - NULL => keep existing assignments unchanged
-- - []   => clear assignments
-- - [...] => replace with provided assignments
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
    is_teacher = CASE WHEN p_updates ? 'is_teacher' THEN (p_updates->>'is_teacher')::BOOLEAN ELSE s.is_teacher END,
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
