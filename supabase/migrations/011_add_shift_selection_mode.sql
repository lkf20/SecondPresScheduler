-- Remove time_slot_id from time_off_requests (no longer needed - shifts stored in time_off_shifts)
ALTER TABLE time_off_requests
  DROP COLUMN IF EXISTS time_slot_id;

-- Add shift_selection_mode field
ALTER TABLE time_off_requests
  ADD COLUMN shift_selection_mode TEXT CHECK (shift_selection_mode IN ('all_scheduled', 'select_shifts'));

-- Set default for existing records (if any)
UPDATE time_off_requests
SET shift_selection_mode = 'all_scheduled'
WHERE shift_selection_mode IS NULL;

