-- Create teacher_schedule_audit_log table to track all changes
-- Migration 025: Create audit log for teacher schedule changes

CREATE TABLE IF NOT EXISTS teacher_schedule_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_schedule_id UUID REFERENCES teacher_schedules(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'conflict_resolved')),
  action_details JSONB,
  removed_from_classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  removed_from_day_id UUID REFERENCES days_of_week(id) ON DELETE SET NULL,
  removed_from_time_slot_id UUID REFERENCES time_slots(id) ON DELETE SET NULL,
  added_to_classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  added_to_day_id UUID REFERENCES days_of_week(id) ON DELETE SET NULL,
  added_to_time_slot_id UUID REFERENCES time_slots(id) ON DELETE SET NULL,
  reason TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_teacher_id ON teacher_schedule_audit_log(teacher_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_teacher_schedule_id ON teacher_schedule_audit_log(teacher_schedule_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON teacher_schedule_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON teacher_schedule_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_reason ON teacher_schedule_audit_log(reason) WHERE reason IS NOT NULL;

-- Enable RLS
ALTER TABLE teacher_schedule_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Audit logs are viewable by authenticated users"
  ON teacher_schedule_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- Audit logs should be insert-only for the system
CREATE POLICY "Audit logs are insertable by authenticated users"
  ON teacher_schedule_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);




