BEGIN;

-- Enable RLS for staff_role_type_assignments
ALTER TABLE staff_role_type_assignments ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read/manage role assignments
CREATE POLICY "Staff role assignments are viewable by authenticated users"
  ON staff_role_type_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff role assignments are manageable by authenticated users"
  ON staff_role_type_assignments FOR ALL
  TO authenticated
  USING (true);

-- Drop legacy role_type_id column from staff
DROP INDEX IF EXISTS idx_staff_role_type_id;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_type_id_fkey;
ALTER TABLE staff DROP COLUMN IF EXISTS role_type_id;

COMMIT;
