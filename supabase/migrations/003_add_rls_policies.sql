-- Row Level Security (RLS) Policies
-- Enable RLS on all tables

ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE days_of_week ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_class_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_classroom_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staffing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_contact_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_contact_log ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all reference data
CREATE POLICY "Reference data is viewable by authenticated users"
  ON classrooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reference data is viewable by authenticated users"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reference data is viewable by authenticated users"
  ON time_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reference data is viewable by authenticated users"
  ON days_of_week FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can read all staff (for now - can be restricted later)
CREATE POLICY "Staff is viewable by authenticated users"
  ON staff FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage their own staff profile
CREATE POLICY "Users can update their own staff profile"
  ON staff FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Authenticated users can read all schedules
CREATE POLICY "Schedules are viewable by authenticated users"
  ON teacher_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Schedules are manageable by authenticated users"
  ON teacher_schedules FOR ALL
  TO authenticated
  USING (true);

-- Policy: Authenticated users can read all sub availability
CREATE POLICY "Sub availability is viewable by authenticated users"
  ON sub_availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sub availability is manageable by authenticated users"
  ON sub_availability FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Sub availability exceptions are viewable by authenticated users"
  ON sub_availability_exceptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sub availability exceptions are manageable by authenticated users"
  ON sub_availability_exceptions FOR ALL
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage preferences
CREATE POLICY "Preferences are viewable by authenticated users"
  ON sub_class_preferences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Preferences are manageable by authenticated users"
  ON sub_class_preferences FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Classroom preferences are viewable by authenticated users"
  ON classroom_preferences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Classroom preferences are manageable by authenticated users"
  ON classroom_preferences FOR ALL
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage mappings and rules
CREATE POLICY "Mappings are viewable by authenticated users"
  ON class_classroom_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Mappings are manageable by authenticated users"
  ON class_classroom_mappings FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Staffing rules are viewable by authenticated users"
  ON staffing_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staffing rules are manageable by authenticated users"
  ON staffing_rules FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Enrollments are viewable by authenticated users"
  ON enrollments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enrollments are manageable by authenticated users"
  ON enrollments FOR ALL
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage time off
CREATE POLICY "Time off requests are viewable by authenticated users"
  ON time_off_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Time off requests are manageable by authenticated users"
  ON time_off_requests FOR ALL
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage sub assignments
CREATE POLICY "Sub assignments are viewable by authenticated users"
  ON sub_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sub assignments are manageable by authenticated users"
  ON sub_assignments FOR ALL
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage contact overrides
CREATE POLICY "Contact overrides are viewable by authenticated users"
  ON sub_contact_overrides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Contact overrides are manageable by authenticated users"
  ON sub_contact_overrides FOR ALL
  TO authenticated
  USING (true);

-- Policy: Authenticated users can manage contact log
CREATE POLICY "Contact log is viewable by authenticated users"
  ON sub_contact_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Contact log is manageable by authenticated users"
  ON sub_contact_log FOR ALL
  TO authenticated
  USING (true);

