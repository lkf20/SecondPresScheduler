-- Migration: Ensure is_contacted and contacted_at columns exist
-- ============================================================================
-- This migration ensures the is_contacted and contacted_at columns exist
-- in substitute_contacts table. It's idempotent and safe to run multiple times.
-- ============================================================================

-- Add is_contacted column if it doesn't exist
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

-- Add contacted_at column if it doesn't exist
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

