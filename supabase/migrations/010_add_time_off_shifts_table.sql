-- Create time_off_shifts table to store individual shifts for time off requests
CREATE TABLE time_off_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_off_request_id UUID NOT NULL REFERENCES time_off_requests(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week_id UUID REFERENCES days_of_week(id),
  time_slot_id UUID NOT NULL REFERENCES time_slots(id),
  is_partial BOOLEAN DEFAULT FALSE,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (time_off_request_id, date, time_slot_id),
  CONSTRAINT time_off_shifts_partial_check CHECK (
    (is_partial = FALSE) OR (is_partial = TRUE AND start_time IS NOT NULL AND end_time IS NOT NULL)
  )
);

-- Add index on time_off_request_id for performance
CREATE INDEX idx_time_off_shifts_request_id ON time_off_shifts(time_off_request_id);

-- Add index on date for filtering
CREATE INDEX idx_time_off_shifts_date ON time_off_shifts(date);

