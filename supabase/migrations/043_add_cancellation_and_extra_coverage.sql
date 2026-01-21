-- Migration: Add cancellation support and extra coverage tracking
-- This migration:
-- 1. Updates time_off_requests status constraint (deleted -> cancelled)
-- 2. Adds status to sub_assignments
-- 3. Creates assignment_kind ENUM and adds to sub_assignments
-- 4. Adds status to coverage_request_shifts
-- 5. Updates coverage_requests request_type to include 'extra_coverage_manual'
-- 6. Deletes all existing sub_assignments (dummy data cleanup)
-- 7. Adds coverage_request_shift_id to sub_assignments

-- ============================================================================
-- 1. Update time_off_requests status constraint
-- ============================================================================
ALTER TABLE time_off_requests
DROP CONSTRAINT IF EXISTS time_off_requests_status_check;

ALTER TABLE time_off_requests
ADD CONSTRAINT time_off_requests_status_check
CHECK (status IN ('draft', 'active', 'cancelled'));

-- Update any existing 'deleted' status to 'cancelled'
UPDATE time_off_requests
SET status = 'cancelled'
WHERE status = 'deleted';

-- ============================================================================
-- 2. Add status to sub_assignments
-- ============================================================================
ALTER TABLE sub_assignments
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_sub_assignments_status ON sub_assignments(status);

-- ============================================================================
-- 3. Create assignment_kind ENUM and add to sub_assignments
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_kind') THEN
    CREATE TYPE assignment_kind AS ENUM ('absence_coverage', 'extra_coverage');
  END IF;
END $$;

ALTER TABLE sub_assignments
ADD COLUMN IF NOT EXISTS assignment_kind assignment_kind NOT NULL DEFAULT 'absence_coverage';

CREATE INDEX IF NOT EXISTS idx_sub_assignments_assignment_kind ON sub_assignments(assignment_kind);

-- ============================================================================
-- 4. Add status to coverage_request_shifts
-- ============================================================================
ALTER TABLE coverage_request_shifts
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_status ON coverage_request_shifts(status);

-- ============================================================================
-- 5. Update coverage_requests request_type constraint
-- ============================================================================
ALTER TABLE coverage_requests
DROP CONSTRAINT IF EXISTS coverage_requests_request_type_check;

ALTER TABLE coverage_requests
ADD CONSTRAINT coverage_requests_request_type_check
CHECK (request_type IN ('time_off', 'manual_coverage', 'emergency', 'extra_coverage_manual'));

-- ============================================================================
-- 6. Delete all existing sub_assignments (dummy data cleanup)
-- ============================================================================
DELETE FROM sub_assignments;

-- ============================================================================
-- 7. Add coverage_request_shift_id to sub_assignments
-- ============================================================================
ALTER TABLE sub_assignments
ADD COLUMN coverage_request_shift_id UUID NOT NULL REFERENCES coverage_request_shifts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sub_assignments_coverage_request_shift ON sub_assignments(coverage_request_shift_id);
