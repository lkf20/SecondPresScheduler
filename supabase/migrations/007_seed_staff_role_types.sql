-- Seed staff_role_types with PERMANENT and FLEXIBLE roles
INSERT INTO staff_role_types (code, label, is_system, active, sort_order) VALUES
  ('PERMANENT', 'Permanent', true, true, 1),
  ('FLEXIBLE', 'Flexible', true, true, 2)
ON CONFLICT (code) DO NOTHING;

-- Update all existing staff records to have role_type_id set to PERMANENT
-- This ensures existing staff have a default role
UPDATE staff
SET role_type_id = (SELECT id FROM staff_role_types WHERE code = 'PERMANENT')
WHERE role_type_id IS NULL;


