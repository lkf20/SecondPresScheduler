-- Create qualification_definitions table
CREATE TABLE IF NOT EXISTS qualification_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  is_system BOOLEAN DEFAULT false,
  school_id UUID, -- nullable, for future multi-tenant support
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT qualification_definitions_name_unique UNIQUE (name)
);

-- Create staff_qualifications table
CREATE TABLE IF NOT EXISTS staff_qualifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  qualification_id UUID NOT NULL REFERENCES qualification_definitions(id) ON DELETE CASCADE,
  level TEXT, -- e.g., "beginner", "intermediate", "advanced"
  expires_on DATE,
  verified BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT staff_qualifications_unique UNIQUE (staff_id, qualification_id)
);

-- Create sub_availability_exception_headers table
CREATE TABLE IF NOT EXISTS sub_availability_exception_headers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sub_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  available BOOLEAN NOT NULL, -- true for "available" exceptions, false for "unavailable"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sub_availability_exception_headers_date_range CHECK (end_date >= start_date)
);

-- Add exception_header_id to sub_availability_exceptions (nullable for backward compatibility)
ALTER TABLE sub_availability_exceptions
ADD COLUMN IF NOT EXISTS exception_header_id UUID REFERENCES sub_availability_exception_headers(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_staff_id ON staff_qualifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_qualification_id ON staff_qualifications(qualification_id);
CREATE INDEX IF NOT EXISTS idx_sub_availability_exception_headers_sub_id ON sub_availability_exception_headers(sub_id);
CREATE INDEX IF NOT EXISTS idx_sub_availability_exception_headers_dates ON sub_availability_exception_headers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sub_availability_exceptions_header_id ON sub_availability_exceptions(exception_header_id);

-- Add comments
COMMENT ON TABLE qualification_definitions IS 'System and school-defined qualification types (e.g., Infant qualified, CPR certified)';
COMMENT ON TABLE staff_qualifications IS 'Staff member qualifications with optional level, expiration, and verification';
COMMENT ON TABLE sub_availability_exception_headers IS 'Headers for availability exceptions spanning date ranges';
COMMENT ON COLUMN sub_availability_exceptions.exception_header_id IS 'Links exception rows to their header for date range exceptions';

-- Seed default qualification definitions
INSERT INTO qualification_definitions (name, category, is_system, is_active) VALUES
  ('Infant qualified', 'Certification', true, true),
  ('CPR certified', 'Certification', true, true),
  ('Special needs experience', 'Skill', true, true),
  ('Language skills', 'Skill', true, true)
ON CONFLICT (name) DO NOTHING;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_qualification_definitions_updated_at
  BEFORE UPDATE ON qualification_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_qualifications_updated_at
  BEFORE UPDATE ON staff_qualifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_availability_exception_headers_updated_at
  BEFORE UPDATE ON sub_availability_exception_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE qualification_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_availability_exception_headers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for qualification_definitions
CREATE POLICY "Qualification definitions are viewable by authenticated users"
  ON qualification_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Qualification definitions are manageable by authenticated users"
  ON qualification_definitions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for staff_qualifications
CREATE POLICY "Staff qualifications are viewable by authenticated users"
  ON staff_qualifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff qualifications are manageable by authenticated users"
  ON staff_qualifications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for sub_availability_exception_headers
CREATE POLICY "Sub availability exception headers are viewable by authenticated users"
  ON sub_availability_exception_headers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sub availability exception headers are manageable by authenticated users"
  ON sub_availability_exception_headers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

