-- Weekly schedule cell notes overrides (date-specific)
-- Supports:
-- - custom override note for a specific date/cell
-- - hidden note for a specific date/cell
-- while preserving baseline schedule_cells.notes as source default.

BEGIN;

CREATE TABLE IF NOT EXISTS weekly_schedule_cell_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  override_mode TEXT NOT NULL CHECK (override_mode IN ('custom', 'hidden')),
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_schedule_cell_notes_mode_note_check CHECK (
    (override_mode = 'custom' AND note IS NOT NULL AND length(btrim(note)) > 0)
    OR (override_mode = 'hidden' AND note IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_schedule_cell_notes_unique_cell_date
  ON weekly_schedule_cell_notes (school_id, date, classroom_id, time_slot_id);

CREATE INDEX IF NOT EXISTS idx_weekly_schedule_cell_notes_school_date
  ON weekly_schedule_cell_notes (school_id, date);

DROP TRIGGER IF EXISTS weekly_schedule_cell_notes_updated_at ON weekly_schedule_cell_notes;
CREATE TRIGGER weekly_schedule_cell_notes_updated_at
  BEFORE UPDATE ON weekly_schedule_cell_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE weekly_schedule_cell_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view weekly schedule cell notes in their school" ON weekly_schedule_cell_notes;
CREATE POLICY "Users can view weekly schedule cell notes in their school"
  ON weekly_schedule_cell_notes FOR SELECT
  TO authenticated
  USING (user_belongs_to_school(school_id));

DROP POLICY IF EXISTS "Users can insert weekly schedule cell notes in their school" ON weekly_schedule_cell_notes;
CREATE POLICY "Users can insert weekly schedule cell notes in their school"
  ON weekly_schedule_cell_notes FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_school(school_id));

DROP POLICY IF EXISTS "Users can update weekly schedule cell notes in their school" ON weekly_schedule_cell_notes;
CREATE POLICY "Users can update weekly schedule cell notes in their school"
  ON weekly_schedule_cell_notes FOR UPDATE
  TO authenticated
  USING (user_belongs_to_school(school_id))
  WITH CHECK (user_belongs_to_school(school_id));

DROP POLICY IF EXISTS "Users can delete weekly schedule cell notes in their school" ON weekly_schedule_cell_notes;
CREATE POLICY "Users can delete weekly schedule cell notes in their school"
  ON weekly_schedule_cell_notes FOR DELETE
  TO authenticated
  USING (user_belongs_to_school(school_id));

COMMENT ON TABLE weekly_schedule_cell_notes IS 'Date-specific weekly schedule note overrides per (school, date, classroom, time slot).';
COMMENT ON COLUMN weekly_schedule_cell_notes.override_mode IS 'custom = display note override; hidden = hide note for this date/cell.';
COMMENT ON COLUMN weekly_schedule_cell_notes.note IS 'Required when override_mode=custom, null when override_mode=hidden.';

COMMIT;
