-- Create staff_role_types reference table
CREATE TABLE IF NOT EXISTS staff_role_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  sort_order INTEGER,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add role_type_id foreign key to staff table
ALTER TABLE staff
  ADD COLUMN role_type_id UUID REFERENCES staff_role_types(id);

-- Add index on staff.role_type_id for performance
CREATE INDEX IF NOT EXISTS idx_staff_role_type_id ON staff(role_type_id);

-- Add index on staff_role_types.code for lookups
CREATE INDEX IF NOT EXISTS idx_staff_role_types_code ON staff_role_types(code);

-- Add index on staff_role_types.active for filtering
CREATE INDEX IF NOT EXISTS idx_staff_role_types_active ON staff_role_types(active);


