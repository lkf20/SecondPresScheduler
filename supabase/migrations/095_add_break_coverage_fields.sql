-- Add break coverage fields to staffing_events
ALTER TABLE staffing_events
ADD COLUMN event_category TEXT NOT NULL DEFAULT 'standard' CHECK (event_category IN ('standard', 'break')),
ADD COLUMN covered_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME;

-- Index for the covered_staff_id
CREATE INDEX idx_staffing_events_covered_staff_id ON staffing_events(covered_staff_id);
