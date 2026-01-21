-- Add INSERT, UPDATE, DELETE policies for class_classroom_mappings table
-- This table needs to be manageable by authenticated users

-- Class-Classroom Mappings policies
CREATE POLICY "Class-classroom mappings are manageable by authenticated users"
  ON class_classroom_mappings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Class-classroom mappings are updatable by authenticated users"
  ON class_classroom_mappings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Class-classroom mappings are deletable by authenticated users"
  ON class_classroom_mappings FOR DELETE
  TO authenticated
  USING (true);

