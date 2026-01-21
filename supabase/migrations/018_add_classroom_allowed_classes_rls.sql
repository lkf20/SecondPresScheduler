-- Add RLS policies for classroom_allowed_classes table
ALTER TABLE classroom_allowed_classes ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view classroom allowed classes
CREATE POLICY "Classroom allowed classes are viewable by authenticated users"
  ON classroom_allowed_classes FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage classroom allowed classes
CREATE POLICY "Classroom allowed classes are manageable by authenticated users"
  ON classroom_allowed_classes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Classroom allowed classes are updatable by authenticated users"
  ON classroom_allowed_classes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Classroom allowed classes are deletable by authenticated users"
  ON classroom_allowed_classes FOR DELETE
  TO authenticated
  USING (true);

