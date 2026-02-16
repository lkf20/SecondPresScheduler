-- Staffing events for flex coverage (header + expanded shifts)
CREATE TABLE IF NOT EXISTS staffing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('flex_assignment')),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staffing_event_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staffing_event_id UUID NOT NULL REFERENCES staffing_events(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week_id UUID REFERENCES days_of_week(id),
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for weekly schedule queries
CREATE INDEX IF NOT EXISTS idx_staffing_event_shifts_school_date
  ON staffing_event_shifts(school_id, date);
CREATE INDEX IF NOT EXISTS idx_staffing_event_shifts_school_classroom_date_time
  ON staffing_event_shifts(school_id, classroom_id, date, time_slot_id);
CREATE INDEX IF NOT EXISTS idx_staffing_event_shifts_school_staff_date_time
  ON staffing_event_shifts(school_id, staff_id, date, time_slot_id);

-- Prevent double-booking a staff member for the same date/time slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_event_shifts_unique_active
  ON staffing_event_shifts(school_id, staff_id, date, time_slot_id)
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE staffing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE staffing_event_shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (match schedule_cells pattern)
CREATE POLICY "Staffing events are viewable by authenticated users"
  ON staffing_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staffing events are manageable by authenticated users"
  ON staffing_events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staffing event shifts are viewable by authenticated users"
  ON staffing_event_shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staffing event shifts are manageable by authenticated users"
  ON staffing_event_shifts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
