-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_school_id ON audit_log(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Add override_availability column to sub_contact_shift_overrides
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sub_contact_shift_overrides' 
    AND column_name = 'override_availability'
  ) THEN
    ALTER TABLE sub_contact_shift_overrides
    ADD COLUMN override_availability BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view audit logs for their school
DROP POLICY IF EXISTS "Users can view audit logs for their school" ON audit_log;
CREATE POLICY "Users can view audit logs for their school" ON audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.school_id = audit_log.school_id
    )
  );

-- Comment
COMMENT ON TABLE audit_log IS 'General audit log for all system actions';
COMMENT ON COLUMN sub_contact_shift_overrides.override_availability IS 'Director override for unavailable shifts';

