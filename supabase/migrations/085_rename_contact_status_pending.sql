-- Migration: Rename substitute_contacts.contact_status awaiting_response -> pending
-- Purpose:
-- 1) Canonicalize contact_status naming to use "pending"
-- 2) Backfill existing rows
-- 3) Keep trigger compatible with legacy "awaiting_response" inputs

BEGIN;

-- First allow both legacy and new values during transition.
ALTER TABLE substitute_contacts
DROP CONSTRAINT IF EXISTS substitute_contacts_contact_status_check;

ALTER TABLE substitute_contacts
ADD CONSTRAINT substitute_contacts_contact_status_check
CHECK (
  contact_status IN ('not_contacted', 'awaiting_response', 'pending', 'confirmed', 'declined_all')
);

-- Backfill legacy values.
UPDATE substitute_contacts
SET contact_status = 'pending'
WHERE contact_status = 'awaiting_response';

-- Enforce canonical values.
ALTER TABLE substitute_contacts
DROP CONSTRAINT IF EXISTS substitute_contacts_contact_status_check;

ALTER TABLE substitute_contacts
ADD CONSTRAINT substitute_contacts_contact_status_check
CHECK (contact_status IN ('not_contacted', 'pending', 'confirmed', 'declined_all'));

COMMENT ON COLUMN substitute_contacts.contact_status IS
'Unified contact workflow status: not_contacted, pending, confirmed, declined_all.';

-- Keep legacy writes compatible by normalizing awaiting_response -> pending.
CREATE OR REPLACE FUNCTION sync_substitute_contacts_contact_status()
RETURNS trigger AS $$
BEGIN
  -- If explicit contact_status provided, normalize legacy fields from it.
  IF NEW.contact_status IS NOT NULL THEN
    IF NEW.contact_status = 'not_contacted' THEN
      NEW.is_contacted := false;
      NEW.response_status := 'none';
    ELSIF NEW.contact_status IN ('pending', 'awaiting_response') THEN
      NEW.contact_status := 'pending';
      NEW.is_contacted := true;
      NEW.response_status := 'pending';
    ELSIF NEW.contact_status = 'confirmed' THEN
      NEW.is_contacted := true;
      NEW.response_status := 'confirmed';
    ELSIF NEW.contact_status = 'declined_all' THEN
      NEW.is_contacted := true;
      NEW.response_status := 'declined_all';
    END IF;
  ELSE
    -- Fallback derive contact_status from legacy fields.
    NEW.contact_status := CASE
      WHEN NEW.response_status = 'confirmed' THEN 'confirmed'
      WHEN NEW.response_status IN ('declined_all', 'declined') THEN 'declined_all'
      WHEN NEW.is_contacted = true THEN 'pending'
      ELSE 'not_contacted'
    END;
  END IF;

  -- Preserve first contact timestamp behavior.
  IF NEW.is_contacted = true AND NEW.contacted_at IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.contacted_at := NOW();
    ELSIF TG_OP = 'UPDATE' AND OLD.contacted_at IS NULL THEN
      NEW.contacted_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
