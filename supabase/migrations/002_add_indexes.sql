-- Indexes for Performance

-- Staff indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- Teacher Schedules indexes
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_teacher ON teacher_schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_day_slot ON teacher_schedules(day_of_week_id, time_slot_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_class ON teacher_schedules(class_id);

-- Sub Availability indexes
CREATE INDEX IF NOT EXISTS idx_sub_availability_sub ON sub_availability(sub_id);
CREATE INDEX IF NOT EXISTS idx_sub_availability_day_slot ON sub_availability(day_of_week_id, time_slot_id);

-- Sub Availability Exceptions indexes
CREATE INDEX IF NOT EXISTS idx_sub_availability_exceptions_sub ON sub_availability_exceptions(sub_id);
CREATE INDEX IF NOT EXISTS idx_sub_availability_exceptions_date ON sub_availability_exceptions(date);

-- Sub Assignments indexes (critical for lookups)
CREATE INDEX IF NOT EXISTS idx_sub_assignments_date_slot_teacher ON sub_assignments(date, time_slot_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_sub_assignments_sub_date_slot ON sub_assignments(sub_id, date, time_slot_id);
CREATE INDEX IF NOT EXISTS idx_sub_assignments_teacher ON sub_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sub_assignments_date ON sub_assignments(date);

-- Time Off Requests indexes
CREATE INDEX IF NOT EXISTS idx_time_off_requests_teacher ON time_off_requests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates ON time_off_requests(start_date, end_date);

-- Sub Contact Overrides indexes
CREATE INDEX IF NOT EXISTS idx_sub_contact_overrides_sub_teacher ON sub_contact_overrides(sub_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_sub_contact_overrides_shift ON sub_contact_overrides(shift_id);

-- Sub Contact Log indexes
CREATE INDEX IF NOT EXISTS idx_sub_contact_log_sub ON sub_contact_log(sub_id);
CREATE INDEX IF NOT EXISTS idx_sub_contact_log_teacher ON sub_contact_log(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sub_contact_log_date ON sub_contact_log(contact_date);

-- Class Classroom Mappings indexes
CREATE INDEX IF NOT EXISTS idx_class_classroom_mappings_class ON class_classroom_mappings(class_id);
CREATE INDEX IF NOT EXISTS idx_class_classroom_mappings_classroom ON class_classroom_mappings(classroom_id);
CREATE INDEX IF NOT EXISTS idx_class_classroom_mappings_day_slot ON class_classroom_mappings(day_of_week_id, time_slot_id);

-- Staffing Rules indexes
CREATE INDEX IF NOT EXISTS idx_staffing_rules_class ON staffing_rules(class_id);
CREATE INDEX IF NOT EXISTS idx_staffing_rules_day_slot ON staffing_rules(day_of_week_id, time_slot_id);

-- Enrollments indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_day_slot ON enrollments(day_of_week_id, time_slot_id);

