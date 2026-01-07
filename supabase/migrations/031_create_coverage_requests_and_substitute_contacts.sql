-- Migration: Create coverage_requests abstraction and substitute contact tracking
-- This migration:
-- 1. Creates "Unknown" classroom placeholder
-- 2. Creates coverage_requests abstraction table with counters
-- 3. Creates coverage_request_shifts table
-- 4. Links time_off_requests to coverage_requests
-- 5. Creates substitute_contacts table (request-level contact tracking)
-- 6. Creates sub_contact_shift_overrides table (shift-level director selections)
-- 7. Auto-updates coverage_request status using counter-based triggers
-- 8. Adds RLS policies for new tables

-- ============================================================================
-- 1. Create "Unknown" classroom placeholder
-- ============================================================================
INSERT INTO classrooms (id, name, capacity, is_active, "order", created_at, updated_at)
SELECT 
  uuid_generate_v4(),
  'Unknown (needs review)',
  NULL,
  true,
  -1, -- Negative order to sort first (or use MAX + 1 if you prefer it last)
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM classrooms WHERE name = 'Unknown (needs review)'
);

-- ============================================================================
-- 2. Create coverage_requests abstraction table with counters
-- ============================================================================
CREATE TABLE IF NOT EXISTS coverage_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_type TEXT NOT NULL CHECK (request_type IN ('time_off', 'manual_coverage', 'emergency')),
  source_request_id UUID, -- Polymorphic reference (time_off_requests.id, etc.)
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  total_shifts INTEGER NOT NULL DEFAULT 0, -- Counter: total shifts needing coverage
  covered_shifts INTEGER NOT NULL DEFAULT 0, -- Counter: shifts with assignments
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT coverage_requests_counters_check CHECK (
    covered_shifts <= total_shifts AND covered_shifts >= 0 AND total_shifts >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_coverage_requests_teacher ON coverage_requests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_dates ON coverage_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_source ON coverage_requests(request_type, source_request_id);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_status ON coverage_requests(status);

-- ============================================================================
-- 3. Create coverage_request_shifts table
-- ============================================================================
CREATE TABLE IF NOT EXISTS coverage_request_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coverage_request_id UUID NOT NULL REFERENCES coverage_requests(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week_id UUID REFERENCES days_of_week(id),
  time_slot_id UUID NOT NULL REFERENCES time_slots(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id), -- Required: which classroom needs coverage
  class_group_id UUID REFERENCES class_groups(id), -- Nullable: which class group (if known)
  is_partial BOOLEAN DEFAULT FALSE,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (coverage_request_id, date, time_slot_id),
  CONSTRAINT coverage_request_shifts_partial_check CHECK (
    (is_partial = FALSE) OR (is_partial = TRUE AND start_time IS NOT NULL AND end_time IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_request ON coverage_request_shifts(coverage_request_id);
CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_date ON coverage_request_shifts(date);
CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_timeslot ON coverage_request_shifts(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_classroom ON coverage_request_shifts(classroom_id);

-- ============================================================================
-- 4. Add coverage_request_id to time_off_requests
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_off_requests' AND column_name = 'coverage_request_id'
  ) THEN
    ALTER TABLE time_off_requests 
      ADD COLUMN coverage_request_id UUID REFERENCES coverage_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_off_requests_coverage_request ON time_off_requests(coverage_request_id);

-- ============================================================================
-- 5. Mark time_off_shifts as deprecated (add comment)
-- ============================================================================
COMMENT ON TABLE time_off_shifts IS 'DEPRECATED: Use coverage_request_shifts instead. This table is maintained for backward compatibility only.';

-- ============================================================================
-- 6. Create substitute_contacts table (request-level)
-- ============================================================================
CREATE TABLE IF NOT EXISTS substitute_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coverage_request_id UUID NOT NULL REFERENCES coverage_requests(id) ON DELETE CASCADE,
  sub_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_contacted', 'contacted', 'pending', 'declined', 'assigned')) DEFAULT 'not_contacted',
  notes TEXT,
  contacted_at TIMESTAMPTZ,
  last_status_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ, -- When status changed to 'assigned'
  declined_at TIMESTAMPTZ, -- When status changed to 'declined'
  created_by UUID REFERENCES staff(id),
  updated_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(coverage_request_id, sub_id)
);

CREATE INDEX IF NOT EXISTS idx_substitute_contacts_coverage_request ON substitute_contacts(coverage_request_id);
CREATE INDEX IF NOT EXISTS idx_substitute_contacts_sub ON substitute_contacts(sub_id);
CREATE INDEX IF NOT EXISTS idx_substitute_contacts_status ON substitute_contacts(status);

-- ============================================================================
-- 7. Create sub_contact_shift_overrides table (shift-level director selections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sub_contact_shift_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  substitute_contact_id UUID NOT NULL REFERENCES substitute_contacts(id) ON DELETE CASCADE,
  coverage_request_shift_id UUID NOT NULL REFERENCES coverage_request_shifts(id) ON DELETE CASCADE,
  selected BOOLEAN NOT NULL DEFAULT true, -- Director selected this shift for assignment
  is_partial BOOLEAN NOT NULL DEFAULT false,
  partial_start_time TIME,
  partial_end_time TIME,
  notes TEXT, -- Optional per-shift notes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(substitute_contact_id, coverage_request_shift_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_overrides_contact ON sub_contact_shift_overrides(substitute_contact_id);
CREATE INDEX IF NOT EXISTS idx_shift_overrides_shift ON sub_contact_shift_overrides(coverage_request_shift_id);

-- ============================================================================
-- 8. Migrate existing time_off_requests to coverage_requests
-- ============================================================================
-- For each existing time_off_request, create a coverage_request and link them
-- Only migrate if not already migrated
INSERT INTO coverage_requests (
  id, 
  request_type, 
  source_request_id, 
  teacher_id, 
  start_date, 
  end_date, 
  status,
  total_shifts,
  covered_shifts,
  created_at, 
  updated_at
)
SELECT 
  uuid_generate_v4(),
  'time_off',
  tor.id,
  tor.teacher_id,
  tor.start_date,
  tor.end_date,
  CASE 
    -- Check if all shifts are covered (have sub_assignments)
    WHEN EXISTS (
      SELECT 1 FROM time_off_shifts tos
      LEFT JOIN sub_assignments sa ON 
        sa.date = tos.date 
        AND sa.time_slot_id = tos.time_slot_id
        AND sa.teacher_id = tor.teacher_id
      WHERE tos.time_off_request_id = tor.id
      AND sa.id IS NULL
    ) THEN 'open'
    ELSE 'filled'
  END,
  (SELECT COUNT(*) FROM time_off_shifts WHERE time_off_request_id = tor.id),
  (SELECT COUNT(DISTINCT tos.id)
   FROM time_off_shifts tos
   INNER JOIN sub_assignments sa ON 
     sa.date = tos.date 
     AND sa.time_slot_id = tos.time_slot_id
     AND sa.teacher_id = tor.teacher_id
   WHERE tos.time_off_request_id = tor.id),
  tor.created_at,
  tor.updated_at
FROM time_off_requests tor
WHERE tor.coverage_request_id IS NULL; -- Only migrate if not already linked

-- Link time_off_requests to their coverage_requests
UPDATE time_off_requests tor
SET coverage_request_id = cr.id
FROM coverage_requests cr
WHERE cr.source_request_id = tor.id AND cr.request_type = 'time_off';

-- ============================================================================
-- 9. Migrate existing time_off_shifts to coverage_request_shifts
-- ============================================================================
-- Use Unknown classroom for shifts where classroom cannot be determined
-- Only migrate if not already migrated
INSERT INTO coverage_request_shifts (
  id,
  coverage_request_id,
  date,
  day_of_week_id,
  time_slot_id,
  classroom_id,
  class_group_id,
  is_partial,
  start_time,
  end_time,
  created_at
)
SELECT 
  tos.id, -- Preserve existing IDs
  tor.coverage_request_id,
  tos.date,
  tos.day_of_week_id,
  tos.time_slot_id,
  COALESCE(
    -- Try to get classroom from teacher_schedules first
    (SELECT ts.classroom_id 
     FROM teacher_schedules ts 
     WHERE ts.teacher_id = tor.teacher_id 
       AND ts.day_of_week_id = tos.day_of_week_id 
       AND ts.time_slot_id = tos.time_slot_id 
     LIMIT 1),
    -- Fallback: use Unknown classroom
    (SELECT id FROM classrooms WHERE name = 'Unknown (needs review)' LIMIT 1)
  ) as classroom_id,
  NULL as class_group_id, -- Will be populated later if needed
  tos.is_partial,
  tos.start_time,
  tos.end_time,
  tos.created_at
FROM time_off_shifts tos
JOIN time_off_requests tor ON tos.time_off_request_id = tor.id
WHERE tor.coverage_request_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM coverage_request_shifts crs 
    WHERE crs.id = tos.id
  ); -- Only migrate if shift not already migrated

-- ============================================================================
-- 10. Function to update total_shifts counter when shifts are added/removed
-- ============================================================================
CREATE OR REPLACE FUNCTION update_coverage_request_total_shifts()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_delta INTEGER;
BEGIN
  -- Determine coverage_request_id and delta
  IF TG_OP = 'INSERT' THEN
    v_coverage_request_id := NEW.coverage_request_id;
    v_delta := 1;
  ELSIF TG_OP = 'DELETE' THEN
    v_coverage_request_id := OLD.coverage_request_id;
    v_delta := -1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If coverage_request_id changed, update both old and new
    IF OLD.coverage_request_id != NEW.coverage_request_id THEN
      -- Decrement old
      UPDATE coverage_requests
      SET total_shifts = total_shifts - 1,
          updated_at = NOW()
      WHERE id = OLD.coverage_request_id;
      -- Increment new
      UPDATE coverage_requests
      SET total_shifts = total_shifts + 1,
          updated_at = NOW()
      WHERE id = NEW.coverage_request_id;
      RETURN NEW;
    ELSE
      -- No change to coverage_request_id, no counter update needed
      RETURN NEW;
    END IF;
  END IF;

  -- Update counter
  UPDATE coverage_requests
  SET 
    total_shifts = total_shifts + v_delta,
    updated_at = NOW()
  WHERE id = v_coverage_request_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_total_shifts_on_shift_change ON coverage_request_shifts;
CREATE TRIGGER trigger_update_total_shifts_on_shift_change
  AFTER INSERT OR UPDATE OR DELETE ON coverage_request_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_coverage_request_total_shifts();

-- ============================================================================
-- 11. Function to update covered_shifts counter when assignments change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_coverage_request_covered_shifts()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_teacher_id UUID;
  v_delta INTEGER;
BEGIN
  -- Get teacher_id and coverage_request_id from the assignment
  IF TG_OP = 'INSERT' THEN
    v_teacher_id := NEW.teacher_id;
    v_delta := 1;
  ELSIF TG_OP = 'DELETE' THEN
    v_teacher_id := OLD.teacher_id;
    v_delta := -1;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If teacher_id or date/time_slot changed, need to update both old and new
    IF (OLD.teacher_id != NEW.teacher_id) OR 
       (OLD.date != NEW.date) OR 
       (OLD.time_slot_id != NEW.time_slot_id) THEN
      -- Decrement old coverage_request
      SELECT cr.id INTO v_coverage_request_id
      FROM coverage_request_shifts crs
      JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
      WHERE crs.date = OLD.date
        AND crs.time_slot_id = OLD.time_slot_id
        AND cr.teacher_id = OLD.teacher_id
      LIMIT 1;
      
      IF v_coverage_request_id IS NOT NULL THEN
        UPDATE coverage_requests
        SET covered_shifts = GREATEST(0, covered_shifts - 1),
            updated_at = NOW()
        WHERE id = v_coverage_request_id;
      END IF;
      
      -- Increment new coverage_request
      SELECT cr.id INTO v_coverage_request_id
      FROM coverage_request_shifts crs
      JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
      WHERE crs.date = NEW.date
        AND crs.time_slot_id = NEW.time_slot_id
        AND cr.teacher_id = NEW.teacher_id
      LIMIT 1;
      
      IF v_coverage_request_id IS NOT NULL THEN
        UPDATE coverage_requests
        SET covered_shifts = covered_shifts + 1,
            updated_at = NOW()
        WHERE id = v_coverage_request_id;
      END IF;
      
      RETURN NEW;
    ELSE
      -- No relevant change, no counter update needed
      RETURN NEW;
    END IF;
  END IF;

  -- Find the coverage_request for this assignment
  SELECT cr.id INTO v_coverage_request_id
  FROM coverage_request_shifts crs
  JOIN coverage_requests cr ON cr.id = crs.coverage_request_id
  WHERE crs.date = COALESCE(NEW.date, OLD.date)
    AND crs.time_slot_id = COALESCE(NEW.time_slot_id, OLD.time_slot_id)
    AND cr.teacher_id = v_teacher_id
  LIMIT 1;

  -- Update counter if we found a matching coverage_request
  IF v_coverage_request_id IS NOT NULL THEN
    UPDATE coverage_requests
    SET 
      covered_shifts = GREATEST(0, covered_shifts + v_delta),
      updated_at = NOW()
    WHERE id = v_coverage_request_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_covered_shifts_on_assignment ON sub_assignments;
CREATE TRIGGER trigger_update_covered_shifts_on_assignment
  AFTER INSERT OR UPDATE OR DELETE ON sub_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_coverage_request_covered_shifts();

-- ============================================================================
-- 12. Function to compute and update status from counters
-- ============================================================================
CREATE OR REPLACE FUNCTION update_coverage_request_status_from_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if not cancelled (cancellation is manual)
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Compute status from counters
  IF NEW.total_shifts = 0 THEN
    -- No shifts, keep current status (or set to 'open'?)
    NEW.status := COALESCE(OLD.status, 'open');
  ELSIF NEW.covered_shifts = NEW.total_shifts AND NEW.total_shifts > 0 THEN
    NEW.status := 'filled';
  ELSE
    NEW.status := 'open';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_status_from_counters ON coverage_requests;
CREATE TRIGGER trigger_update_status_from_counters
  BEFORE UPDATE OF total_shifts, covered_shifts ON coverage_requests
  FOR EACH ROW
  WHEN (OLD.total_shifts IS DISTINCT FROM NEW.total_shifts OR 
        OLD.covered_shifts IS DISTINCT FROM NEW.covered_shifts)
  EXECUTE FUNCTION update_coverage_request_status_from_counters();

-- ============================================================================
-- 13. Trigger to auto-update assigned_at when status changes to 'assigned'
-- ============================================================================
CREATE OR REPLACE FUNCTION update_substitute_contact_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_status_at on any status change
  NEW.last_status_at = NOW();
  
  -- Set assigned_at when status changes to 'assigned'
  IF NEW.status = 'assigned' AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN
    NEW.assigned_at = NOW();
  END IF;
  
  -- Set declined_at when status changes to 'declined'
  IF NEW.status = 'declined' AND (OLD.status IS NULL OR OLD.status != 'declined') THEN
    NEW.declined_at = NOW();
  END IF;
  
  -- Set contacted_at when status changes from 'not_contacted' to anything else
  IF NEW.status != 'not_contacted' AND (OLD.status IS NULL OR OLD.status = 'not_contacted') THEN
    NEW.contacted_at = NOW();
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_substitute_contact_timestamps ON substitute_contacts;
CREATE TRIGGER trigger_update_substitute_contact_timestamps
  BEFORE UPDATE ON substitute_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_substitute_contact_timestamps();

-- ============================================================================
-- 14. Trigger to auto-update updated_at on shift overrides
-- ============================================================================
CREATE OR REPLACE FUNCTION update_shift_override_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_shift_override_timestamp ON sub_contact_shift_overrides;
CREATE TRIGGER trigger_update_shift_override_timestamp
  BEFORE UPDATE ON sub_contact_shift_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_override_timestamp();

-- ============================================================================
-- 15. Enable RLS on new tables
-- ============================================================================
-- RLS is enabled by default when creating tables, but ensure it's enabled
DO $$ 
BEGIN
  -- Enable RLS (idempotent - no error if already enabled)
  ALTER TABLE coverage_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE coverage_request_shifts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE substitute_contacts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE sub_contact_shift_overrides ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN
    -- RLS might already be enabled, continue
    NULL;
END $$;

-- ============================================================================
-- 16. RLS Policies: Simple "authenticated users can manage everything"
-- ============================================================================

-- Coverage Requests
DROP POLICY IF EXISTS "Coverage requests are viewable by authenticated users" ON coverage_requests;
CREATE POLICY "Coverage requests are viewable by authenticated users"
  ON coverage_requests FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Coverage requests are manageable by authenticated users" ON coverage_requests;
CREATE POLICY "Coverage requests are manageable by authenticated users"
  ON coverage_requests FOR ALL
  TO authenticated
  USING (true);

-- Coverage Request Shifts
DROP POLICY IF EXISTS "Coverage request shifts are viewable by authenticated users" ON coverage_request_shifts;
CREATE POLICY "Coverage request shifts are viewable by authenticated users"
  ON coverage_request_shifts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Coverage request shifts are manageable by authenticated users" ON coverage_request_shifts;
CREATE POLICY "Coverage request shifts are manageable by authenticated users"
  ON coverage_request_shifts FOR ALL
  TO authenticated
  USING (true);

-- Substitute Contacts
DROP POLICY IF EXISTS "Substitute contacts are viewable by authenticated users" ON substitute_contacts;
CREATE POLICY "Substitute contacts are viewable by authenticated users"
  ON substitute_contacts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Substitute contacts are manageable by authenticated users" ON substitute_contacts;
CREATE POLICY "Substitute contacts are manageable by authenticated users"
  ON substitute_contacts FOR ALL
  TO authenticated
  USING (true);

-- Shift Overrides
DROP POLICY IF EXISTS "Shift overrides are viewable by authenticated users" ON sub_contact_shift_overrides;
CREATE POLICY "Shift overrides are viewable by authenticated users"
  ON sub_contact_shift_overrides FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Shift overrides are manageable by authenticated users" ON sub_contact_shift_overrides;
CREATE POLICY "Shift overrides are manageable by authenticated users"
  ON sub_contact_shift_overrides FOR ALL
  TO authenticated
  USING (true);

