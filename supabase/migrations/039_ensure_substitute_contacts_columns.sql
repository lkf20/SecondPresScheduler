-- Migration: Ensure all required columns exist in substitute_contacts
-- ============================================================================
-- This migration ensures all required columns exist in substitute_contacts table.
-- It's idempotent and safe to run multiple times.
-- ============================================================================

-- Add response_status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'substitute_contacts' 
      AND column_name = 'response_status'
  ) THEN
    -- Add response_status column
    ALTER TABLE substitute_contacts
    ADD COLUMN response_status TEXT NOT NULL DEFAULT 'none';
    
    -- If there's an old 'status' column, migrate values
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public'
        AND table_name = 'substitute_contacts' 
        AND column_name = 'status'
    ) THEN
      UPDATE substitute_contacts
      SET response_status = CASE
        WHEN status = 'not_contacted' THEN 'none'
        WHEN status = 'contacted' THEN 'none'
        WHEN status = 'pending' THEN 'pending'
        WHEN status = 'declined' THEN 'declined_all'
        WHEN status = 'assigned' THEN 'none'
        ELSE 'none'
      END
      WHERE response_status = 'none'; -- Only update if still default
    END IF;
    
    -- Add constraint for response_status
    ALTER TABLE substitute_contacts
    ADD CONSTRAINT substitute_contacts_response_status_check 
    CHECK (response_status IN ('none', 'pending', 'confirmed', 'declined_all'));
    
    COMMENT ON COLUMN substitute_contacts.response_status IS 'Response status: none (no response yet), pending, confirmed (some or all shifts), or declined_all. Assigned status is derived from sub_assignments.';
  ELSE
    -- Column exists, but ensure constraint is correct
    -- Drop existing constraint if it exists
    ALTER TABLE substitute_contacts
    DROP CONSTRAINT IF EXISTS substitute_contacts_response_status_check;
    
    -- Add updated constraint
    ALTER TABLE substitute_contacts
    ADD CONSTRAINT substitute_contacts_response_status_check 
    CHECK (response_status IN ('none', 'pending', 'confirmed', 'declined_all'));
  END IF;
END $$;

-- Ensure is_contacted column exists (in case migration 038 wasn't run)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'substitute_contacts' 
      AND column_name = 'is_contacted'
  ) THEN
    ALTER TABLE substitute_contacts
    ADD COLUMN is_contacted BOOLEAN NOT NULL DEFAULT false;
    
    COMMENT ON COLUMN substitute_contacts.is_contacted IS 'Whether the sub has been contacted';
  END IF;
END $$;

-- Ensure contacted_at column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'substitute_contacts' 
      AND column_name = 'contacted_at'
  ) THEN
    ALTER TABLE substitute_contacts
    ADD COLUMN contacted_at TIMESTAMP WITH TIME ZONE;
    
    COMMENT ON COLUMN substitute_contacts.contacted_at IS 'Timestamp when sub was first contacted (preserved even if is_contacted is later set to false)';
  END IF;
END $$;

