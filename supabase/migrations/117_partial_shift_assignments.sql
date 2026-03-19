-- Migration 117: Partial shift assignments (Phase 1)
-- Activates is_partial / partial_start_time / partial_end_time columns on sub_assignments.
-- Allows multiple active assignments per coverage_request_shift when is_partial = true,
-- while enforcing uniqueness for full (is_partial = false) assignments.
-- Rewrites the covered_shifts trigger to be status-transition + count-aware so
-- UPDATE SET status = 'cancelled' correctly decrements the counter.
-- See docs: /Users/lisafrist/.cursor/plans/partial_shift_phase_1_883c4083.plan.md

-- ============================================================================
-- Step 1: Normalize is_partial — enforce NOT NULL
-- ============================================================================

-- Backfill any NULLs (defensive; there should be none in practice)
UPDATE sub_assignments SET is_partial = false WHERE is_partial IS NULL;

-- Enforce NOT NULL going forward so index predicates are reliable
ALTER TABLE sub_assignments ALTER COLUMN is_partial SET NOT NULL;

-- ============================================================================
-- Step 2: Drop the blocking unique index (one active per shift, unconditional)
-- (Guard that required no existing partials was removed so migration can run
-- when active partial assignments already exist, e.g. from a pre-117 app or test data.)
-- ============================================================================

DROP INDEX IF EXISTS idx_sub_assignments_one_active_per_shift;

-- ============================================================================
-- Step 3: Create conditional unique index (full assignments only)
-- Only one active FULL assignment per coverage_request_shift_id is allowed.
-- Multiple active PARTIAL assignments are permitted.
-- Safe because Step 1 guarantees is_partial is never NULL (no predicate gap).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_assignments_one_active_full_per_shift
  ON sub_assignments (coverage_request_shift_id)
  WHERE status = 'active' AND is_partial = false;

-- ============================================================================
-- Step 4: Rewrite covered_shifts trigger — status-transition + count-aware
-- Replaces the previous version (migration 111/112) which only fired on
-- coverage_request_shift_id changes and ignored status transitions.
-- The new trigger increments covered_shifts only when the FIRST active
-- assignment is inserted for a shift, and decrements only when the LAST
-- active assignment is removed or cancelled.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_coverage_request_covered_shifts()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_existing_count INTEGER;
BEGIN
  -- -----------------------------------------------------------------------
  -- INSERT path
  -- -----------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    -- Scope guard: only process rows linked to a coverage_request_shift
    IF NEW.coverage_request_shift_id IS NULL OR NEW.status != 'active' THEN
      RETURN NEW;
    END IF;

    -- Count existing active assignments for this shift, excluding the new row
    SELECT COUNT(*) INTO v_existing_count
    FROM sub_assignments
    WHERE coverage_request_shift_id = NEW.coverage_request_shift_id
      AND status = 'active'
      AND id != NEW.id;

    -- Only increment if this is the FIRST active assignment for this shift
    IF v_existing_count = 0 THEN
      SELECT crs.coverage_request_id INTO v_coverage_request_id
      FROM coverage_request_shifts crs
      WHERE crs.id = NEW.coverage_request_shift_id;

      IF v_coverage_request_id IS NOT NULL THEN
        UPDATE coverage_requests
        SET covered_shifts = LEAST(total_shifts, GREATEST(0, covered_shifts + 1)),
            updated_at = NOW()
        WHERE id = v_coverage_request_id;
      END IF;
    END IF;

    RETURN NEW;

  -- -----------------------------------------------------------------------
  -- DELETE path
  -- -----------------------------------------------------------------------
  ELSIF TG_OP = 'DELETE' THEN
    -- Scope guard: only process active rows linked to a coverage_request_shift
    IF OLD.coverage_request_shift_id IS NULL OR OLD.status != 'active' THEN
      RETURN OLD;
    END IF;

    -- Count remaining active assignments for this shift after deletion
    SELECT COUNT(*) INTO v_existing_count
    FROM sub_assignments
    WHERE coverage_request_shift_id = OLD.coverage_request_shift_id
      AND status = 'active'
      AND id != OLD.id;

    -- Only decrement if this was the LAST active assignment
    IF v_existing_count = 0 THEN
      SELECT crs.coverage_request_id INTO v_coverage_request_id
      FROM coverage_request_shifts crs
      WHERE crs.id = OLD.coverage_request_shift_id;

      IF v_coverage_request_id IS NOT NULL THEN
        UPDATE coverage_requests
        SET covered_shifts = GREATEST(0, covered_shifts - 1),
            updated_at = NOW()
        WHERE id = v_coverage_request_id;
      END IF;
    END IF;

    RETURN OLD;

  -- -----------------------------------------------------------------------
  -- UPDATE path
  -- -----------------------------------------------------------------------
  ELSIF TG_OP = 'UPDATE' THEN

    -- Case A: coverage_request_shift_id changed (rare, but handle it)
    IF OLD.coverage_request_shift_id IS DISTINCT FROM NEW.coverage_request_shift_id THEN

      -- Decrement old shift if it had an active assignment being moved away
      IF OLD.coverage_request_shift_id IS NOT NULL AND OLD.status = 'active' THEN
        SELECT COUNT(*) INTO v_existing_count
        FROM sub_assignments
        WHERE coverage_request_shift_id = OLD.coverage_request_shift_id
          AND status = 'active'
          AND id != OLD.id;

        IF v_existing_count = 0 THEN
          SELECT crs.coverage_request_id INTO v_coverage_request_id
          FROM coverage_request_shifts crs
          WHERE crs.id = OLD.coverage_request_shift_id;

          IF v_coverage_request_id IS NOT NULL THEN
            UPDATE coverage_requests
            SET covered_shifts = GREATEST(0, covered_shifts - 1),
                updated_at = NOW()
            WHERE id = v_coverage_request_id;
          END IF;
        END IF;
      END IF;

      -- Increment new shift if this is now an active assignment for it
      IF NEW.coverage_request_shift_id IS NOT NULL AND NEW.status = 'active' THEN
        SELECT COUNT(*) INTO v_existing_count
        FROM sub_assignments
        WHERE coverage_request_shift_id = NEW.coverage_request_shift_id
          AND status = 'active'
          AND id != NEW.id;

        IF v_existing_count = 0 THEN
          SELECT crs.coverage_request_id INTO v_coverage_request_id
          FROM coverage_request_shifts crs
          WHERE crs.id = NEW.coverage_request_shift_id;

          IF v_coverage_request_id IS NOT NULL THEN
            UPDATE coverage_requests
            SET covered_shifts = LEAST(total_shifts, GREATEST(0, covered_shifts + 1)),
                updated_at = NOW()
            WHERE id = v_coverage_request_id;
          END IF;
        END IF;
      END IF;

      RETURN NEW;
    END IF;

    -- Case B: status transition active -> non-active (e.g. cancelled)
    -- This is the critical case the previous trigger missed entirely.
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      IF NEW.coverage_request_shift_id IS NULL THEN
        RETURN NEW;
      END IF;

      SELECT COUNT(*) INTO v_existing_count
      FROM sub_assignments
      WHERE coverage_request_shift_id = NEW.coverage_request_shift_id
        AND status = 'active'
        AND id != NEW.id;

      -- Only decrement if this was the last active assignment for this shift
      IF v_existing_count = 0 THEN
        SELECT crs.coverage_request_id INTO v_coverage_request_id
        FROM coverage_request_shifts crs
        WHERE crs.id = NEW.coverage_request_shift_id;

        IF v_coverage_request_id IS NOT NULL THEN
          UPDATE coverage_requests
          SET covered_shifts = GREATEST(0, covered_shifts - 1),
              updated_at = NOW()
          WHERE id = v_coverage_request_id;
        END IF;
      END IF;

      RETURN NEW;
    END IF;

    -- Case C: status transition non-active -> active (uncommon)
    IF OLD.status != 'active' AND NEW.status = 'active' THEN
      IF NEW.coverage_request_shift_id IS NULL THEN
        RETURN NEW;
      END IF;

      SELECT COUNT(*) INTO v_existing_count
      FROM sub_assignments
      WHERE coverage_request_shift_id = NEW.coverage_request_shift_id
        AND status = 'active'
        AND id != NEW.id;

      -- Only increment if this is the first active assignment for this shift
      IF v_existing_count = 0 THEN
        SELECT crs.coverage_request_id INTO v_coverage_request_id
        FROM coverage_request_shifts crs
        WHERE crs.id = NEW.coverage_request_shift_id;

        IF v_coverage_request_id IS NOT NULL THEN
          UPDATE coverage_requests
          SET covered_shifts = LEAST(total_shifts, GREATEST(0, covered_shifts + 1)),
              updated_at = NOW()
          WHERE id = v_coverage_request_id;
        END IF;
      END IF;

      RETURN NEW;
    END IF;

    -- Case D: all other UPDATE cases (no status change, no shift_id change) — no-op
    RETURN NEW;

  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 5: Reconcile counters after migration
-- Recalculates covered_shifts and status for all open/filled coverage requests.
-- Uses COUNT(DISTINCT coverage_request_shift_id) on active sub_assignments
-- linked to active coverage_request_shifts — naturally correct for multi-partial.
-- ============================================================================

WITH accurate_counts AS (
  SELECT cr.id AS coverage_request_id,
         COUNT(DISTINCT sa.coverage_request_shift_id) AS cnt
  FROM coverage_requests cr
  LEFT JOIN coverage_request_shifts crs
    ON crs.coverage_request_id = cr.id AND crs.status = 'active'
  LEFT JOIN sub_assignments sa
    ON sa.coverage_request_shift_id = crs.id AND sa.status = 'active'
  WHERE cr.status IN ('open', 'filled')
  GROUP BY cr.id
)
UPDATE coverage_requests cr
SET covered_shifts = LEAST(cr.total_shifts, COALESCE(ac.cnt, 0)),
    status = (CASE
      WHEN cr.total_shifts > 0 AND COALESCE(ac.cnt, 0) >= cr.total_shifts THEN 'filled'
      ELSE 'open'
    END)::coverage_request_status,
    updated_at = NOW()
FROM accurate_counts ac
WHERE cr.id = ac.coverage_request_id
  AND (
    cr.covered_shifts != LEAST(cr.total_shifts, COALESCE(ac.cnt, 0))
    OR (cr.status = 'filled' AND COALESCE(ac.cnt, 0) < cr.total_shifts)
    OR (cr.status = 'open' AND cr.total_shifts > 0 AND COALESCE(ac.cnt, 0) >= cr.total_shifts)
  );

-- ============================================================================
-- Step 6: Post-migration assertions
-- ============================================================================

-- Assert 1: No NULL is_partial values remain
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sub_assignments WHERE is_partial IS NULL) THEN
    RAISE EXCEPTION 'Post-migration assertion failed: is_partial contains NULL values';
  END IF;
END $$;

-- Assert 2: New conditional full-assignment unique index exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_sub_assignments_one_active_full_per_shift'
  ) THEN
    RAISE EXCEPTION 'Post-migration assertion failed: conditional full-assignment index not found';
  END IF;
END $$;

-- Assert 3: Old one-per-shift index is gone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_sub_assignments_one_active_per_shift'
  ) THEN
    RAISE EXCEPTION 'Post-migration assertion failed: old one-per-shift index still exists';
  END IF;
END $$;

-- Assert 4: Counters are consistent (no request has covered > total or negative counts)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM coverage_requests
    WHERE status IN ('open', 'filled')
      AND (covered_shifts > total_shifts OR covered_shifts < 0)
  ) THEN
    RAISE EXCEPTION 'Post-migration assertion failed: coverage_requests counter inconsistency detected';
  END IF;
END $$;
