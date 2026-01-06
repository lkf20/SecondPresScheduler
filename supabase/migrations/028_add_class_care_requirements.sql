-- Add care requirement fields to classes table
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS diaper_changing_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lifting_children_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS toileting_assistance_required BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN classes.diaper_changing_required IS 'Class requires staff who can change diapers';
COMMENT ON COLUMN classes.lifting_children_required IS 'Class requires staff who can lift children';
COMMENT ON COLUMN classes.toileting_assistance_required IS 'Class requires staff who can assist with toileting';

