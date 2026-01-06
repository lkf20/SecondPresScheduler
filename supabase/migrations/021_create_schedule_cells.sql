-- Create schedule_cells table to store cell configuration (classroom × weekday × time block)
CREATE TABLE IF NOT EXISTS schedule_cells (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  day_of_week_id UUID NOT NULL REFERENCES days_of_week(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  enrollment_for_staffing INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(classroom_id, day_of_week_id, time_slot_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_cells_classroom_day_time ON schedule_cells(classroom_id, day_of_week_id, time_slot_id);
CREATE INDEX IF NOT EXISTS idx_schedule_cells_classroom ON schedule_cells(classroom_id);
CREATE INDEX IF NOT EXISTS idx_schedule_cells_day ON schedule_cells(day_of_week_id);
CREATE INDEX IF NOT EXISTS idx_schedule_cells_time_slot ON schedule_cells(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_schedule_cells_class ON schedule_cells(class_id) WHERE class_id IS NOT NULL;

-- Add trigger for updated_at
CREATE TRIGGER schedule_cells_updated_at
  BEFORE UPDATE ON schedule_cells
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE schedule_cells ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Schedule cells are viewable by authenticated users"
  ON schedule_cells FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Schedule cells are manageable by authenticated users"
  ON schedule_cells FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);





