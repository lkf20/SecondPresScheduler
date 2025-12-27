-- Add reason column to time_off_requests table
ALTER TABLE time_off_requests
  ADD COLUMN reason TEXT;

-- Add constraint to ensure reason is one of the allowed values
ALTER TABLE time_off_requests
  ADD CONSTRAINT time_off_requests_reason_check 
  CHECK (reason IS NULL OR reason IN ('Vacation', 'Sick Day', 'Training', 'Other'));

