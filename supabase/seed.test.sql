-- Seed data for automated tests against local Supabase.
-- Keep deterministic and minimal; avoid production-like volume.
--
-- QA / Phase 1: "School A" is the default school from migrations (034).
-- UUID: 00000000-0000-0000-0000-000000000001
-- Use for repeatable QA: known school, same checks every time.
-- Add targeted inserts below as test suites grow (e.g. days_of_week,
-- time_slots with fixed IDs for the default school).

begin;

-- Add targeted inserts here as feature test suites grow.
-- Example (ensure deterministic days/slots for School A):
-- insert into days_of_week (id, name, day_number, display_order)
--   values ('...', 'Monday', 1, 1) on conflict do nothing;
-- insert into time_slots (id, code, name, school_id, display_order)
--   values ('...', 'AM', 'Morning', '00000000-0000-0000-0000-000000000001', 1) on conflict do nothing;

commit;

