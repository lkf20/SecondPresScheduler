-- Atomically replace role assignments for a staff member.
CREATE OR REPLACE FUNCTION set_staff_role_assignments_atomic(
  p_staff_id UUID,
  p_role_type_ids UUID[],
  p_school_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_role_type_id UUID;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23502',
      MESSAGE = 'school_id is required for role assignments';
  END IF;

  DELETE FROM staff_role_type_assignments
  WHERE staff_id = p_staff_id;

  IF p_role_type_ids IS NULL OR cardinality(p_role_type_ids) = 0 THEN
    RETURN;
  END IF;

  FOR v_role_type_id IN
    SELECT DISTINCT role_type_id
    FROM unnest(p_role_type_ids) AS role_type_id
  LOOP
    INSERT INTO staff_role_type_assignments (staff_id, role_type_id, school_id)
    VALUES (p_staff_id, v_role_type_id, p_school_id);
  END LOOP;
END;
$$;
