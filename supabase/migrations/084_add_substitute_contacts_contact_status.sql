-- Migration: Add unified contact_status to substitute_contacts
-- Purpose:
-- 1) Add contact_status column with values:
--    not_contacted | awaiting_response | confirmed | declined_all
-- 2) Backfill from legacy is_contacted + response_status
-- 3) Keep contact_status and legacy fields in sync during transition

ALTER TABLE substitute_contacts
ADD COLUMN IF NOT EXISTS contact_status TEXT;

UPDATE substitute_contacts
SET contact_status = CASE
  WHEN response_status = 'confirmed' THEN 'confirmed'
  WHEN response_status IN ('declined_all', 'declined') THEN 'declined_all'
  WHEN is_contacted = true THEN 'awaiting_response'
  ELSE 'not_contacted'
END
WHERE contact_status IS NULL
   OR contact_status NOT IN ('not_contacted', 'awaiting_response', 'confirmed', 'declined_all');

ALTER TABLE substitute_contacts
ALTER COLUMN contact_status SET DEFAULT 'not_contacted';

ALTER TABLE substitute_contacts
ALTER COLUMN contact_status SET NOT NULL;

ALTER TABLE substitute_contacts
DROP CONSTRAINT IF EXISTS substitute_contacts_contact_status_check;

ALTER TABLE substitute_contacts
ADD CONSTRAINT substitute_contacts_contact_status_check
CHECK (contact_status IN ('not_contacted', 'awaiting_response', 'confirmed', 'declined_all'));

COMMENT ON COLUMN substitute_contacts.contact_status IS
'Unified contact workflow status: not_contacted, awaiting_response, confirmed, declined_all.';

CREATE OR REPLACE FUNCTION sync_substitute_contacts_contact_status()
RETURNS trigger AS $$
BEGIN
  -- If explicit contact_status provided, normalize legacy fields from it.
  IF NEW.contact_status IS NOT NULL THEN
    IF NEW.contact_status = 'not_contacted' THEN
      NEW.is_contacted := false;
      NEW.response_status := 'none';
    ELSIF NEW.contact_status = 'awaiting_response' THEN
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
      WHEN NEW.is_contacted = true THEN 'awaiting_response'
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

DROP TRIGGER IF EXISTS trigger_sync_substitute_contacts_contact_status ON substitute_contacts;

CREATE TRIGGER trigger_sync_substitute_contacts_contact_status
BEFORE INSERT OR UPDATE ON substitute_contacts
FOR EACH ROW
EXECUTE FUNCTION sync_substitute_contacts_contact_status();
