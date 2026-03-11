-- MIGRATION 101
-- Purpose: Add Today Schedule report rich-text default header/footer fields
-- Safe to run multiple times: Yes
-- Requires downtime: No
-- Reversible: Yes

BEGIN;

ALTER TABLE schedule_settings
  ADD COLUMN IF NOT EXISTS daily_schedule_top_header_html text;

ALTER TABLE schedule_settings
  ADD COLUMN IF NOT EXISTS daily_schedule_footer_notes_html text;

COMMIT;
