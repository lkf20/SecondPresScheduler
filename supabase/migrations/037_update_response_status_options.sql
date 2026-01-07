-- Migration: Update response_status to include 'confirmed' and rename 'declined' to 'declined_all'
-- ============================================================================
-- This migration:
-- 1. Updates the CHECK constraint to allow 'confirmed' and 'declined_all'
-- 2. Migrates existing 'declined' values to 'declined_all'

-- ============================================================================
-- 1. Migrate existing 'declined' to 'declined_all'
-- ============================================================================
UPDATE substitute_contacts
SET response_status = 'declined_all'
WHERE response_status = 'declined';

-- ============================================================================
-- 2. Update the CHECK constraint
-- ============================================================================
ALTER TABLE substitute_contacts
DROP CONSTRAINT IF EXISTS substitute_contacts_response_status_check;

ALTER TABLE substitute_contacts
ADD CONSTRAINT substitute_contacts_response_status_check 
CHECK (response_status IN ('none', 'pending', 'confirmed', 'declined_all'));

-- ============================================================================
-- 3. Update comment
-- ============================================================================
COMMENT ON COLUMN substitute_contacts.response_status IS 'Response status: none (no response yet), pending, confirmed (some or all shifts), or declined_all. Assigned status is derived from sub_assignments.';

