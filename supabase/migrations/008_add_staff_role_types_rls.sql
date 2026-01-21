-- Enable RLS on staff_role_types table
ALTER TABLE staff_role_types ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all staff role types
CREATE POLICY "Staff role types are viewable by authenticated users"
  ON staff_role_types FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage staff role types
CREATE POLICY "Staff role types are manageable by authenticated users"
  ON staff_role_types FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff role types are updatable by authenticated users"
  ON staff_role_types FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Staff role types are deletable by authenticated users"
  ON staff_role_types FOR DELETE
  TO authenticated
  USING (true);


