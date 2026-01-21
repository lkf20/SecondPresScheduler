-- Migration 029: Rename classes to class_groups and update all references
-- This is a major refactoring to support multiple class groups per schedule cell

-- Step 1: Create the new class_groups table with the same structure as classes
-- Note: This migration assumes classes table already has all fields from previous migrations
CREATE TABLE IF NOT EXISTS class_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  parent_class_id UUID REFERENCES class_groups(id) ON DELETE SET NULL,
  min_age INTEGER,
  max_age INTEGER,
  required_ratio INTEGER NOT NULL DEFAULT 8,
  preferred_ratio INTEGER,
  diaper_changing_required BOOLEAN DEFAULT false,
  lifting_children_required BOOLEAN DEFAULT false,
  toileting_assistance_required BOOLEAN DEFAULT false,
  "order" INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Copy all data from classes to class_groups
INSERT INTO class_groups (id, name, parent_class_id, min_age, max_age, required_ratio, preferred_ratio, diaper_changing_required, lifting_children_required, toileting_assistance_required, "order", created_at, updated_at)
SELECT id, name, parent_class_id, min_age, max_age, required_ratio, preferred_ratio, 
       COALESCE(diaper_changing_required, false),
       COALESCE(lifting_children_required, false),
       COALESCE(toileting_assistance_required, false),
       "order",
       created_at, updated_at
FROM classes
ON CONFLICT (id) DO NOTHING;

-- Step 3: Update parent_class_id references to point to class_groups
UPDATE class_groups
SET parent_class_id = NULL
WHERE parent_class_id IS NOT NULL AND parent_class_id NOT IN (SELECT id FROM class_groups);

-- Step 4: Create the schedule_cell_class_groups join table
CREATE TABLE IF NOT EXISTS schedule_cell_class_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_cell_id UUID NOT NULL REFERENCES schedule_cells(id) ON DELETE CASCADE,
  class_group_id UUID NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedule_cell_id, class_group_id)
);

-- Step 5: Migrate existing schedule_cells.class_id data to the join table
INSERT INTO schedule_cell_class_groups (schedule_cell_id, class_group_id)
SELECT sc.id, sc.class_id
FROM schedule_cells sc
WHERE sc.class_id IS NOT NULL
ON CONFLICT (schedule_cell_id, class_group_id) DO NOTHING;

-- Step 6: Create indexes for the join table
CREATE INDEX IF NOT EXISTS idx_schedule_cell_class_groups_schedule_cell ON schedule_cell_class_groups(schedule_cell_id);
CREATE INDEX IF NOT EXISTS idx_schedule_cell_class_groups_class_group ON schedule_cell_class_groups(class_group_id);

-- Step 7: Update other tables that reference classes
-- Update teacher_schedules
ALTER TABLE teacher_schedules
  DROP CONSTRAINT IF EXISTS teacher_schedules_class_id_fkey,
  ADD CONSTRAINT teacher_schedules_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES class_groups(id) ON DELETE SET NULL;

-- Update sub_class_preferences
ALTER TABLE sub_class_preferences
  DROP CONSTRAINT IF EXISTS sub_class_preferences_class_id_fkey,
  ADD CONSTRAINT sub_class_preferences_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES class_groups(id) ON DELETE CASCADE;

-- Update class_classroom_mappings
ALTER TABLE class_classroom_mappings
  DROP CONSTRAINT IF EXISTS class_classroom_mappings_class_id_fkey,
  ADD CONSTRAINT class_classroom_mappings_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES class_groups(id) ON DELETE CASCADE;

-- Update classroom_allowed_classes
ALTER TABLE classroom_allowed_classes
  DROP CONSTRAINT IF EXISTS classroom_allowed_classes_class_id_fkey,
  ADD CONSTRAINT classroom_allowed_classes_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES class_groups(id) ON DELETE CASCADE;

-- Update staffing_rules
ALTER TABLE staffing_rules
  DROP CONSTRAINT IF EXISTS staffing_rules_class_id_fkey,
  ADD CONSTRAINT staffing_rules_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES class_groups(id) ON DELETE CASCADE;

-- Update enrollments
ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_class_id_fkey,
  ADD CONSTRAINT enrollments_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES class_groups(id) ON DELETE CASCADE;

-- Step 8: Remove class_id from schedule_cells (after migration)
ALTER TABLE schedule_cells DROP COLUMN IF EXISTS class_id;

-- Step 9: Drop old indexes that reference classes
DROP INDEX IF EXISTS idx_schedule_cells_class;
DROP INDEX IF EXISTS idx_schedule_cells_class_active;

-- Step 10: Enable RLS on new table
ALTER TABLE class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_cell_class_groups ENABLE ROW LEVEL SECURITY;

-- Step 11: Create RLS policies for class_groups
CREATE POLICY "Class groups are viewable by authenticated users"
  ON class_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Class groups are manageable by authenticated users"
  ON class_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Step 12: Create RLS policies for schedule_cell_class_groups
CREATE POLICY "Schedule cell class groups are viewable by authenticated users"
  ON schedule_cell_class_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Schedule cell class groups are manageable by authenticated users"
  ON schedule_cell_class_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Step 13: Add trigger for updated_at on class_groups
CREATE TRIGGER class_groups_updated_at
  BEFORE UPDATE ON class_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 14: Create indexes for class_groups
CREATE INDEX IF NOT EXISTS idx_class_groups_parent ON class_groups(parent_class_id) WHERE parent_class_id IS NOT NULL;

-- Note: We will drop the old classes table in a later migration after verifying everything works
-- For now, we keep it for safety

