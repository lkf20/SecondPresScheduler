BEGIN;

-- 1) Create assignments table (many-to-many between staff and staff_role_types)
CREATE TABLE IF NOT EXISTS staff_role_type_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_type_id UUID NOT NULL REFERENCES staff_role_types(id) ON DELETE CASCADE,
  school_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) Prevent duplicate assignments per staff/role
CREATE UNIQUE INDEX IF NOT EXISTS staff_role_type_assignments_staff_role_uq
  ON staff_role_type_assignments(staff_id, role_type_id);

-- 3) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_staff_role_type_assignments_staff_id
  ON staff_role_type_assignments(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_role_type_assignments_role_type_id
  ON staff_role_type_assignments(role_type_id);

CREATE INDEX IF NOT EXISTS idx_staff_role_type_assignments_school_id
  ON staff_role_type_assignments(school_id);

-- 4) Backfill from staff.role_type_id
INSERT INTO staff_role_type_assignments (staff_id, role_type_id, school_id)
SELECT s.id, s.role_type_id, s.school_id
FROM staff s
WHERE s.role_type_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
