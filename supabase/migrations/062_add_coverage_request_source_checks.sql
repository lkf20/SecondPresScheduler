BEGIN;

-- 1) Fail fast if existing data violates expectations
DO $$
BEGIN
  -- time_off coverage_requests must have source_request_id pointing to time_off_requests.id
  IF EXISTS (
    SELECT 1
    FROM coverage_requests cr
    LEFT JOIN time_off_requests tor ON tor.id = cr.source_request_id
    WHERE cr.request_type = 'time_off'
      AND (cr.source_request_id IS NULL OR tor.id IS NULL)
  ) THEN
    RAISE EXCEPTION
      'coverage_requests: time_off rows with missing/invalid source_request_id found';
  END IF;

  -- extra_coverage coverage_requests must have source_request_id pointing to coverage_requests.id
  IF EXISTS (
    SELECT 1
    FROM coverage_requests cr
    LEFT JOIN coverage_requests parent ON parent.id = cr.source_request_id
    WHERE cr.request_type = 'extra_coverage'
      AND (cr.source_request_id IS NULL OR parent.id IS NULL)
  ) THEN
    RAISE EXCEPTION
      'coverage_requests: extra_coverage rows with missing/invalid source_request_id found';
  END IF;
END $$;

-- If the migration fails, use these queries to inspect bad rows:
-- time_off violations:
--   SELECT cr.*
--   FROM coverage_requests cr
--   LEFT JOIN time_off_requests tor ON tor.id = cr.source_request_id
--   WHERE cr.request_type = 'time_off'
--     AND (cr.source_request_id IS NULL OR tor.id IS NULL);
--
-- extra_coverage violations:
--   SELECT cr.*
--   FROM coverage_requests cr
--   LEFT JOIN coverage_requests parent ON parent.id = cr.source_request_id
--   WHERE cr.request_type = 'extra_coverage'
--     AND (cr.source_request_id IS NULL OR parent.id IS NULL);

-- 2) Enforce non-null source_request_id for both request types
ALTER TABLE coverage_requests
  ADD CONSTRAINT coverage_requests_source_request_id_required_check
  CHECK (
    (request_type IN ('time_off', 'extra_coverage') AND source_request_id IS NOT NULL)
  );

-- 3) Partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_coverage_requests_active
  ON coverage_requests (school_id, status, request_type)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_active
  ON coverage_request_shifts (school_id, status)
  WHERE status = 'active';

COMMIT;
