-- MIGRATION 100
-- Purpose: Persist Sub Availability report default rich-text header/footer per school
-- Safe to run multiple times: Yes
-- Requires downtime: No
-- Reversible: Yes

BEGIN;

ALTER TABLE schedule_settings
  ADD COLUMN IF NOT EXISTS sub_availability_top_header_html TEXT;

ALTER TABLE schedule_settings
  ADD COLUMN IF NOT EXISTS sub_availability_footer_notes_html TEXT;

COMMIT;
