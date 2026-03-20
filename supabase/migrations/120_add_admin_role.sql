-- Add ADMIN staff role type (per school) and extend exclusivity: at most one of Permanent, Flexible, Admin (+ optional Substitute).

BEGIN;

INSERT INTO staff_role_types (school_id, code, label, is_system, active, sort_order)
SELECT s.id, 'ADMIN', 'Admin', true, true, 3
FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

CREATE OR REPLACE FUNCTION enforce_staff_permanent_flexible_exclusive()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  staff_id_val UUID;
  staff_school_id UUID;
  perm_count INT;
  flex_count INT;
  admin_count INT;
  perm_id UUID;
  flex_id UUID;
  admin_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    staff_id_val := OLD.staff_id;
  ELSE
    staff_id_val := NEW.staff_id;
  END IF;

  SELECT school_id INTO staff_school_id FROM staff WHERE id = staff_id_val;

  IF staff_school_id IS NOT NULL THEN
    SELECT id INTO perm_id FROM staff_role_types WHERE code = 'PERMANENT' AND school_id = staff_school_id;
    SELECT id INTO flex_id FROM staff_role_types WHERE code = 'FLEXIBLE' AND school_id = staff_school_id;
    SELECT id INTO admin_id FROM staff_role_types WHERE code = 'ADMIN' AND school_id = staff_school_id;
  ELSE
    SELECT id INTO perm_id FROM staff_role_types WHERE code = 'PERMANENT' LIMIT 1;
    SELECT id INTO flex_id FROM staff_role_types WHERE code = 'FLEXIBLE' LIMIT 1;
    SELECT id INTO admin_id FROM staff_role_types WHERE code = 'ADMIN' LIMIT 1;
  END IF;

  IF perm_id IS NULL OR flex_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE role_type_id = perm_id),
    COUNT(*) FILTER (WHERE role_type_id = flex_id),
    COUNT(*) FILTER (WHERE admin_id IS NOT NULL AND role_type_id = admin_id)
  INTO perm_count, flex_count, admin_count
  FROM staff_role_type_assignments
  WHERE staff_id = staff_id_val;

  IF (perm_count + flex_count + admin_count) > 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A staff member can be at most one of Permanent, Flexible, or Admin. Choose one, and optionally Substitute.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMIT;
