-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Reference Tables

-- 1. Classrooms
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Classes
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  parent_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Time Slots
CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT,
  default_start_time TIME,
  default_end_time TIME,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Days of Week
CREATE TABLE days_of_week (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  day_number INTEGER UNIQUE NOT NULL,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- People Tables

-- 5. Staff
CREATE TABLE staff (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  is_teacher BOOLEAN DEFAULT FALSE,
  is_sub BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Schedule Tables

-- 6. Teacher Schedules
CREATE TABLE teacher_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week_id UUID NOT NULL REFERENCES days_of_week(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (teacher_id, day_of_week_id, time_slot_id)
);

-- 7. Sub Availability
CREATE TABLE sub_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week_id UUID NOT NULL REFERENCES days_of_week(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (sub_id, day_of_week_id, time_slot_id)
);

-- 8. Sub Availability Exceptions
CREATE TABLE sub_availability_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (sub_id, date, time_slot_id)
);

-- Preference Tables

-- 9. Sub Class Preferences
CREATE TABLE sub_class_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  can_teach BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (sub_id, class_id)
);

-- 10. Classroom Preferences
CREATE TABLE classroom_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  can_teach BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (staff_id, classroom_id)
);

-- Rules & Configuration Tables

-- 11. Class Classroom Mappings
CREATE TABLE class_classroom_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  day_of_week_id UUID NOT NULL REFERENCES days_of_week(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (class_id, classroom_id, day_of_week_id, time_slot_id)
);

-- 12. Staffing Rules
CREATE TABLE staffing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week_id UUID NOT NULL REFERENCES days_of_week(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  preferred_teachers INTEGER NOT NULL,
  required_teachers INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (class_id, day_of_week_id, time_slot_id)
);

-- 13. Enrollments
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week_id UUID NOT NULL REFERENCES days_of_week(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  enrollment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (class_id, day_of_week_id, time_slot_id)
);

-- Assignment & Calendar Tables

-- 14. Time Off Requests
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  time_slot_id UUID REFERENCES time_slots(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Sub Assignments
CREATE TABLE sub_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week_id UUID NOT NULL REFERENCES days_of_week(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('Substitute Shift', 'Partial Sub Shift')),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  is_partial BOOLEAN DEFAULT FALSE,
  partial_start_time TIME,
  partial_end_time TIME,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Sub Contact Overrides
CREATE TABLE sub_contact_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL,
  will_work BOOLEAN DEFAULT TRUE,
  is_partial BOOLEAN DEFAULT FALSE,
  start_time TEXT,
  end_time TEXT,
  contact_status TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (sub_id, teacher_id, shift_id)
);

-- 17. Sub Contact Log
CREATE TABLE sub_contact_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  contact_date DATE NOT NULL,
  contact_status TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_classrooms_updated_at BEFORE UPDATE ON classrooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teacher_schedules_updated_at BEFORE UPDATE ON teacher_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_availability_updated_at BEFORE UPDATE ON sub_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_class_preferences_updated_at BEFORE UPDATE ON sub_class_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classroom_preferences_updated_at BEFORE UPDATE ON classroom_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_classroom_mappings_updated_at BEFORE UPDATE ON class_classroom_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staffing_rules_updated_at BEFORE UPDATE ON staffing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_off_requests_updated_at BEFORE UPDATE ON time_off_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_assignments_updated_at BEFORE UPDATE ON sub_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_contact_overrides_updated_at BEFORE UPDATE ON sub_contact_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

