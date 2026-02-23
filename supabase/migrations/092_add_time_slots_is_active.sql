-- Add soft-delete support for time slots.
ALTER TABLE time_slots
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Ensure existing rows are marked active.
UPDATE time_slots
SET is_active = TRUE
WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_time_slots_school_active
ON time_slots (school_id, is_active, display_order);
