-- Add capability fields to staff table for subs
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS can_change_diapers BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_lift_children BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_assist_with_toileting BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS capabilities_notes TEXT;

-- Add comments
COMMENT ON COLUMN staff.can_change_diapers IS 'Sub capability: Can change diapers';
COMMENT ON COLUMN staff.can_lift_children IS 'Sub capability: Can lift children';
COMMENT ON COLUMN staff.can_assist_with_toileting IS 'Sub capability: Can assist with toileting';
COMMENT ON COLUMN staff.capabilities_notes IS 'Optional notes about sub capabilities';



