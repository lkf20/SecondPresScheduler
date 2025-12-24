-- Add INSERT, UPDATE, DELETE policies for reference data tables
-- These tables need to be manageable by authenticated users

-- Classes policies
CREATE POLICY "Classes are manageable by authenticated users"
  ON classes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Classes are updatable by authenticated users"
  ON classes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Classes are deletable by authenticated users"
  ON classes FOR DELETE
  TO authenticated
  USING (true);

-- Classrooms policies
CREATE POLICY "Classrooms are manageable by authenticated users"
  ON classrooms FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Classrooms are updatable by authenticated users"
  ON classrooms FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Classrooms are deletable by authenticated users"
  ON classrooms FOR DELETE
  TO authenticated
  USING (true);

-- Time slots policies
CREATE POLICY "Time slots are manageable by authenticated users"
  ON time_slots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Time slots are updatable by authenticated users"
  ON time_slots FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Time slots are deletable by authenticated users"
  ON time_slots FOR DELETE
  TO authenticated
  USING (true);

-- Staff policies (for creating/updating staff records)
-- Drop the restrictive policy first, then add permissive ones
DROP POLICY IF EXISTS "Users can update their own staff profile" ON staff;

CREATE POLICY "Staff is insertable by authenticated users"
  ON staff FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff is updatable by authenticated users"
  ON staff FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Staff is deletable by authenticated users"
  ON staff FOR DELETE
  TO authenticated
  USING (true);

