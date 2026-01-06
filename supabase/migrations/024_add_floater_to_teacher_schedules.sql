-- Add is_floater column to teacher_schedules table
-- Migration 024: Add floater designation to teacher schedules

ALTER TABLE teacher_schedules 
  ADD COLUMN IF NOT EXISTS is_floater BOOLEAN NOT NULL DEFAULT false;

-- Add index for floater queries
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_is_floater 
  ON teacher_schedules(is_floater) 
  WHERE is_floater = true;

-- Add composite index for conflict detection queries
-- This helps with queries looking for non-floater conflicts
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_floater_lookup
  ON teacher_schedules(teacher_id, day_of_week_id, time_slot_id, is_floater);


