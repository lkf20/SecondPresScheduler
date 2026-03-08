-- Migration 099: Add school calendar settings (first/last day of school, school closures)
-- Enables directors to define the school year and granular closures (holidays, snow days, etc.)

-- Step 1: Add first_day_of_school and last_day_of_school to schedule_settings
ALTER TABLE schedule_settings
  ADD COLUMN IF NOT EXISTS first_day_of_school DATE,
  ADD COLUMN IF NOT EXISTS last_day_of_school DATE;

-- Step 2: Create school_closures table for granular closures
-- time_slot_id NULL = whole day closed; non-null = only that time slot closed on that date
CREATE TABLE IF NOT EXISTS school_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot_id UUID REFERENCES time_slots(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One whole-day closure per (school_id, date); one per-slot closure per (school_id, date, time_slot_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_closures_whole_day_unique
  ON school_closures (school_id, date) WHERE time_slot_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_closures_slot_unique
  ON school_closures (school_id, date, time_slot_id) WHERE time_slot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_closures_school_date
  ON school_closures(school_id, date);

-- Step 3: Enable RLS on school_closures
ALTER TABLE school_closures ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only access closures for their school
CREATE POLICY "Users can view school closures in their school"
  ON school_closures FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Users can insert school closures in their school"
  ON school_closures FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_school(school_id));

CREATE POLICY "Users can update school closures in their school"
  ON school_closures FOR UPDATE
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

CREATE POLICY "Users can delete school closures in their school"
  ON school_closures FOR DELETE
  TO authenticated
  USING (user_belongs_to_school(school_id));

COMMENT ON TABLE school_closures IS 'Days or time slots when school is closed (holidays, snow days, etc.)';
COMMENT ON COLUMN school_closures.time_slot_id IS 'When NULL, the entire day is closed. When set, only that time slot is closed on that date.';
