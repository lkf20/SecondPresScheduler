-- Create junction table for classroom-class relationships (allowed classes)
CREATE TABLE IF NOT EXISTS classroom_allowed_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (classroom_id, class_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_classroom_allowed_classes_classroom ON classroom_allowed_classes(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_allowed_classes_class ON classroom_allowed_classes(class_id);

