-- Migration: Update substitute_contacts to use is_contacted, contacted_at, and response_status
-- ============================================================================
-- This migration:
-- 1. Adds is_contacted (boolean) and contacted_at (nullable timestamp) fields
-- 2. Renames status to response_status with values: 'none' | 'pending' | 'declined'
-- 3. Removes 'assigned' as a status option (it's now derived from sub_assignments)

-- ============================================================================
-- 1. Add new fields
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'substitute_contacts' AND column_name = 'is_contacted'
  ) THEN
    ALTER TABLE substitute_contacts
    ADD COLUMN is_contacted BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'substitute_contacts' AND column_name = 'contacted_at'
  ) THEN
    ALTER TABLE substitute_contacts
    ADD COLUMN contacted_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- ============================================================================
-- 2. Migrate existing status values to response_status
-- ============================================================================
DO $$ 
BEGIN
  -- Check if response_status column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'substitute_contacts' AND column_name = 'response_status'
  ) THEN
    -- Add response_status column
    ALTER TABLE substitute_contacts
    ADD COLUMN response_status TEXT DEFAULT 'none';
    
    -- Migrate existing status values
    UPDATE substitute_contacts
    SET response_status = CASE
      WHEN status = 'not_contacted' THEN 'none'
      WHEN status = 'contacted' THEN 'none' -- Keep as 'none' since contacted is tracked separately
      WHEN status = 'pending' THEN 'pending'
      WHEN status = 'declined' THEN 'declined'
      WHEN status = 'assigned' THEN 'none' -- Assigned is now derived, not a status
      ELSE 'none'
    END,
    is_contacted = CASE
      WHEN status IN ('contacted', 'pending', 'declined', 'assigned') THEN true
      ELSE false
    END;
    
    -- Set contacted_at for existing contacted records (use updated_at as approximation)
    UPDATE substitute_contacts
    SET contacted_at = updated_at
    WHERE is_contacted = true AND contacted_at IS NULL;
    
    -- Add constraint for response_status
    ALTER TABLE substitute_contacts
    ADD CONSTRAINT substitute_contacts_response_status_check 
    CHECK (response_status IN ('none', 'pending', 'declined'));
    
    -- Add comment
    COMMENT ON COLUMN substitute_contacts.response_status IS 'Response status: none (no response yet), pending, or declined. Assigned status is derived from sub_assignments.';
    COMMENT ON COLUMN substitute_contacts.is_contacted IS 'Whether the sub has been contacted';
    COMMENT ON COLUMN substitute_contacts.contacted_at IS 'Timestamp when sub was first contacted (preserved even if is_contacted is later set to false)';
  END IF;
END $$;

-- ============================================================================
-- 3. Update triggers to handle new fields
-- ============================================================================
-- The existing trigger for updated_at should already handle these fields
-- No additional triggers needed

-- ============================================================================
-- 4. Note: We keep the old 'status' column for now to avoid breaking existing code
-- It can be dropped in a future migration after all code is updated
-- ============================================================================

