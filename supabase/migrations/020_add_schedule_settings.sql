-- Create schedule_settings table to store selected days for schedule structure
CREATE TABLE IF NOT EXISTS schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selected_day_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a single row constraint (only one settings record)
CREATE UNIQUE INDEX IF NOT EXISTS schedule_settings_single_row ON schedule_settings ((1));

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_schedule_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_settings_updated_at
  BEFORE UPDATE ON schedule_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_schedule_settings_updated_at();

-- Enable RLS
ALTER TABLE schedule_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Schedule settings are viewable by authenticated users"
  ON schedule_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Schedule settings are manageable by authenticated users"
  ON schedule_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Schedule settings are updatable by authenticated users"
  ON schedule_settings FOR UPDATE
  TO authenticated
  USING (true);

-- Insert default empty settings if none exist
INSERT INTO schedule_settings (selected_day_ids)
SELECT '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schedule_settings);

