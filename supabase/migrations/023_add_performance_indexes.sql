-- Additional performance indexes for common query patterns
-- Migration 023: Add performance indexes

-- Teacher Schedules: Composite index for filtering by classroom, day, and time slot
-- This is used heavily in weekly schedule queries
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_classroom_day_slot 
  ON teacher_schedules(classroom_id, day_of_week_id, time_slot_id);

-- Teacher Schedules: Composite index for filtering by class, day, and time slot
-- Used when looking up assignments for a specific class
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_class_day_slot 
  ON teacher_schedules(class_id, day_of_week_id, time_slot_id);

-- Enrollments: Composite index for filtering by class, day, and time slot
-- This is the primary lookup pattern for enrollment data
CREATE INDEX IF NOT EXISTS idx_enrollments_class_day_slot 
  ON enrollments(class_id, day_of_week_id, time_slot_id);

-- Staffing Rules: Composite index for filtering by class, day, and time slot
-- Used when calculating staffing requirements
CREATE INDEX IF NOT EXISTS idx_staffing_rules_class_day_slot 
  ON staffing_rules(class_id, day_of_week_id, time_slot_id);

-- Schedule Cells: Index for filtering by class_id (when class_id is set)
-- This helps with lookups when filtering by class
CREATE INDEX IF NOT EXISTS idx_schedule_cells_class_active 
  ON schedule_cells(class_id, is_active) 
  WHERE class_id IS NOT NULL;


