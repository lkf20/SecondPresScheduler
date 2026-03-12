-- Enforce: a staff member may have at most one of PERMANENT or FLEXIBLE role type.
-- (They may be Permanent + Substitute, or Flexible + Substitute, but not both Permanent and Flexible.)
BEGIN;

CREATE OR REPLACE FUNCTION enforce_staff_permanent_flexible_exclusive()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  staff_id_val UUID;
  perm_count INT;
  flex_count INT;
  perm_id UUID;
  flex_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    staff_id_val := OLD.staff_id;
  ELSE
    staff_id_val := NEW.staff_id;
  END IF;

  SELECT id INTO perm_id FROM staff_role_types WHERE code = 'PERMANENT' LIMIT 1;
  SELECT id INTO flex_id FROM staff_role_types WHERE code = 'FLEXIBLE' LIMIT 1;

  IF perm_id IS NULL OR flex_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE role_type_id = perm_id),
    COUNT(*) FILTER (WHERE role_type_id = flex_id)
  INTO perm_count, flex_count
  FROM staff_role_type_assignments
  WHERE staff_id = staff_id_val;

  IF perm_count > 0 AND flex_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A staff member cannot be both Permanent and Flexible. Choose one, and optionally Substitute.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_staff_permanent_flexible_exclusive ON staff_role_type_assignments;
CREATE TRIGGER trigger_staff_permanent_flexible_exclusive
AFTER INSERT OR UPDATE OR DELETE ON staff_role_type_assignments
FOR EACH ROW
EXECUTE FUNCTION enforce_staff_permanent_flexible_exclusive();

COMMIT;
