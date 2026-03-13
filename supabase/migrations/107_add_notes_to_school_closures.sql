-- Migration 107: Add optional notes to school_closures
-- Used on the School Calendar Add/Edit Closure forms for additional context (e.g. early dismissal details).

ALTER TABLE school_closures
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN school_closures.notes IS 'Optional notes for the closure (e.g. early dismissal details).';
