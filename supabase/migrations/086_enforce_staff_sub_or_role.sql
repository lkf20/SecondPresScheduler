BEGIN;

-- Enforce: every staff member must either be marked as substitute (is_sub = true)
-- OR have at least one role assignment row.
--
-- We use DEFERRABLE constraint triggers because this rule spans two tables:
-- - staff
-- - staff_role_type_assignments
--
-- Deferring to transaction end allows valid multi-step updates (e.g. role swap).

CREATE OR REPLACE FUNCTION enforce_staff_sub_or_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  check_staff_id UUID;
BEGIN
  -- Helper check for one staff id
  -- Valid if staff row does not exist (deleted in same transaction),
  -- or if is_sub = true, or if at least one assignment exists.
  --
  -- Raise 23514 to behave like a check-constraint violation.
  IF TG_TABLE_NAME = 'staff' THEN
    check_staff_id := NEW.id;

    IF NOT EXISTS (SELECT 1 FROM staff s WHERE s.id = check_staff_id) THEN
      RETURN NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM staff s
      WHERE s.id = check_staff_id
        AND (
          s.is_sub = TRUE
          OR EXISTS (
            SELECT 1
            FROM staff_role_type_assignments a
            WHERE a.staff_id = s.id
          )
        )
    ) THEN
      RETURN NULL;
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Each staff member must be marked as substitute or have at least one staff role assignment.';
  END IF;

  -- staff_role_type_assignments trigger path
  IF TG_OP = 'DELETE' THEN
    check_staff_id := OLD.staff_id;
  ELSE
    check_staff_id := NEW.staff_id;
  END IF;

  IF check_staff_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM staff s WHERE s.id = check_staff_id) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM staff s
        WHERE s.id = check_staff_id
          AND (
            s.is_sub = TRUE
            OR EXISTS (
              SELECT 1
              FROM staff_role_type_assignments a
              WHERE a.staff_id = s.id
            )
          )
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Each staff member must be marked as substitute or have at least one staff role assignment.';
      END IF;
    END IF;
  END IF;

  -- On UPDATE of assignment staff_id, validate the old owner too.
  IF TG_OP = 'UPDATE' AND OLD.staff_id IS DISTINCT FROM NEW.staff_id THEN
    check_staff_id := OLD.staff_id;

    IF check_staff_id IS NOT NULL AND EXISTS (SELECT 1 FROM staff s WHERE s.id = check_staff_id) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM staff s
        WHERE s.id = check_staff_id
          AND (
            s.is_sub = TRUE
            OR EXISTS (
              SELECT 1
              FROM staff_role_type_assignments a
              WHERE a.staff_id = s.id
            )
          )
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Each staff member must be marked as substitute or have at least one staff role assignment.';
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_staff_requires_sub_or_role ON staff;
CREATE CONSTRAINT TRIGGER trigger_staff_requires_sub_or_role
AFTER INSERT OR UPDATE OF is_sub ON staff
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_staff_sub_or_role();

DROP TRIGGER IF EXISTS trigger_staff_assignment_requires_sub_or_role ON staff_role_type_assignments;
CREATE CONSTRAINT TRIGGER trigger_staff_assignment_requires_sub_or_role
AFTER INSERT OR UPDATE OR DELETE ON staff_role_type_assignments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_staff_sub_or_role();

COMMIT;
