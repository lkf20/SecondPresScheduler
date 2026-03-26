-- MIGRATION 122
-- Purpose: Add updated_at tracking to coverage_request_shifts and keep it current via trigger
-- Safe to run multiple times: Yes
-- Requires downtime: No
-- Reversible: Yes

BEGIN;

ALTER TABLE coverage_request_shifts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Defensive backfill for environments where existing rows may not have been populated.
UPDATE coverage_request_shifts
SET updated_at = now()
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION set_coverage_request_shifts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_coverage_request_shifts_updated_at ON coverage_request_shifts;

CREATE TRIGGER trigger_set_coverage_request_shifts_updated_at
BEFORE UPDATE ON coverage_request_shifts
FOR EACH ROW
EXECUTE FUNCTION set_coverage_request_shifts_updated_at();

COMMIT;
