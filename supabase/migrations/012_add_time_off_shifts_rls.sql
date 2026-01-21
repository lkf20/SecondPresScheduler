-- Enable RLS on time_off_shifts table
ALTER TABLE time_off_shifts ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all time off shifts
CREATE POLICY "Time off shifts are viewable by authenticated users"
  ON time_off_shifts FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage time off shifts
CREATE POLICY "Time off shifts are manageable by authenticated users"
  ON time_off_shifts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Time off shifts are updatable by authenticated users"
  ON time_off_shifts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Time off shifts are deletable by authenticated users"
  ON time_off_shifts FOR DELETE
  TO authenticated
  USING (true);

