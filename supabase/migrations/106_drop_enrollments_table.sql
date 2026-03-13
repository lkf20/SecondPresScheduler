-- Migration 106: Drop legacy enrollments table
-- Enrollment and ratio are stored per cell in schedule_cells (enrollment_for_staffing,
-- required_staff_override, preferred_staff_override) and schedule_cell_class_groups (enrollment).
-- The enrollments table (class_group + day + slot, no classroom) was never written to by the app
-- and is unused; the API and UI have been removed in favor of cell-based enrollment.

DROP TRIGGER IF EXISTS update_enrollments_updated_at ON enrollments;

DROP POLICY IF EXISTS "Enrollments are viewable by authenticated users" ON enrollments;
DROP POLICY IF EXISTS "Enrollments are manageable by authenticated users" ON enrollments;

DROP TABLE IF EXISTS enrollments;
