-- Migration 046: Update RLS policies to filter by school_id for multi-tenancy
-- This migration updates RLS policies to use school_id filtering

-- Reuse the user_belongs_to_school function from migration 036
-- (It should already exist, but we'll create it if it doesn't)
CREATE OR REPLACE FUNCTION user_belongs_to_school(check_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = auth.uid()
    AND school_id = check_school_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for classrooms
DROP POLICY IF EXISTS "Reference data is viewable by authenticated users" ON classrooms;
CREATE POLICY "Classrooms are viewable by users in same school"
  ON classrooms FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Classrooms are manageable by users in same school"
  ON classrooms FOR ALL
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

-- Update RLS policies for time_slots
DROP POLICY IF EXISTS "Reference data is viewable by authenticated users" ON time_slots;
CREATE POLICY "Time slots are viewable by users in same school"
  ON time_slots FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Time slots are manageable by users in same school"
  ON time_slots FOR ALL
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

-- Update RLS policies for class_groups (formerly classes)
DROP POLICY IF EXISTS "Reference data is viewable by authenticated users" ON class_groups;
CREATE POLICY "Class groups are viewable by users in same school"
  ON class_groups FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Class groups are manageable by users in same school"
  ON class_groups FOR ALL
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

-- Update RLS policies for teacher_schedules
DROP POLICY IF EXISTS "Schedules are viewable by authenticated users" ON teacher_schedules;
DROP POLICY IF EXISTS "Schedules are manageable by authenticated users" ON teacher_schedules;
CREATE POLICY "Teacher schedules are viewable by users in same school"
  ON teacher_schedules FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Teacher schedules are manageable by users in same school"
  ON teacher_schedules FOR ALL
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

-- Update RLS policies for staffing_rules
DROP POLICY IF EXISTS "Staffing rules are viewable by authenticated users" ON staffing_rules;
DROP POLICY IF EXISTS "Staffing rules are manageable by authenticated users" ON staffing_rules;
CREATE POLICY "Staffing rules are viewable by users in same school"
  ON staffing_rules FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Staffing rules are manageable by users in same school"
  ON staffing_rules FOR ALL
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

-- Update RLS policies for schedule_cells
DROP POLICY IF EXISTS "Schedule cells are viewable by authenticated users" ON schedule_cells;
DROP POLICY IF EXISTS "Schedule cells are manageable by authenticated users" ON schedule_cells;
CREATE POLICY "Schedule cells are viewable by users in same school"
  ON schedule_cells FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Schedule cells are manageable by users in same school"
  ON schedule_cells FOR ALL
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

-- Update RLS policies for schedule_settings
DROP POLICY IF EXISTS "Schedule settings are viewable by authenticated users" ON schedule_settings;
DROP POLICY IF EXISTS "Schedule settings are manageable by authenticated users" ON schedule_settings;
DROP POLICY IF EXISTS "Schedule settings are updatable by authenticated users" ON schedule_settings;
CREATE POLICY "Schedule settings are viewable by users in same school"
  ON schedule_settings FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Schedule settings are manageable by users in same school"
  ON schedule_settings FOR ALL
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

-- Note: days_of_week remains viewable by all authenticated users (shared reference data)
