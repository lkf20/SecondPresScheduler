# Temporary Coverage Refactor Plan

This document outlines the step-by-step plan to refactor the staff and assignments conceptual models, specifically transitioning from `is_teacher` and `flex_assignment` to role-based definitions and `temporary_coverage`.

## 1. Database Migrations

- [ ] **Create Migration File:** Generate a new Supabase migration file (e.g., `supabase/migrations/XXXXX_temporary_coverage_refactor.sql`).
- [ ] **Update `staffing_events` Table:**
  - [ ] Rename the `event_type` enum value from `'flex_assignment'` to `'temporary_coverage'`. Note: Postgres enum updates can be tricky; it might require altering the type or updating the text values if stored as a string. If it's a string check constraint, update the constraint.
  - [ ] Update existing rows in `staffing_events` where `event_type = 'flex_assignment'` to `'temporary_coverage'`.
- [ ] **Update `staff` Table:**
  - [ ] Ensure the `role` column (or equivalent) supports `'PERMANENT'` and `'FLEXIBLE'` if not already present.
  - [ ] Drop the `is_teacher` boolean column from the `staff` table.
- [ ] **Update Views/Functions:**
  - [ ] Review and update any database views, materialized views, or RPC functions that reference `is_teacher` or `'flex_assignment'`.

## 2. Backend/API Updates

- [ ] **Type Definitions:**
  - [ ] Update TypeScript types/interfaces (e.g., in `types/database.ts` or `types/index.ts`) to remove `is_teacher`.
  - [ ] Update `EventType` or equivalent literal types to replace `'flex_assignment'` with `'temporary_coverage'`.
- [ ] **Staffing Events API (`app/api/staffing-events/`):**
  - [ ] Update POST/PUT endpoints to accept and validate `'temporary_coverage'` instead of `'flex_assignment'`.
  - [ ] Update GET endpoints to return `'temporary_coverage'`.
- [ ] **Staff API (`app/api/staff/`):**
  - [ ] Remove references to `is_teacher` in creation and update payloads.
  - [ ] Update queries that filtered by `is_teacher = true` to instead filter by `role IN ('PERMANENT', 'FLEXIBLE')`.
- [ ] **Availability APIs (`app/api/availability/` or similar):**
  - [ ] Update logic to allow both Baseline Permanent (`'PERMANENT'`) and Baseline Flex (`'FLEXIBLE'`) staff to be eligible for `temporary_coverage`.
  - [ ] Ensure the availability queries check for existing schedules and absences correctly for these roles.

## 3. UI/Component Updates

- [ ] **Staff Management UI (`components/staff/`):**
  - [ ] Remove the "Is Teacher" toggle/checkbox from the Staff Form (`StaffForm.tsx` or similar).
  - [ ] Ensure role selection (Permanent, Flexible, etc.) is clearly presented.
  - [ ] Update staff list views to display roles instead of a "Teacher" badge.
- [ ] **Schedule & Assignment UI (`components/schedules/`):**
  - [ ] Rename all user-facing text from "Flex Assignment" to "Temporary Coverage".
  - [ ] Update the assignment modal/panel to use the new terminology.
  - [ ] Update the API payload sent from the UI when creating a temporary coverage assignment.
- [ ] **Weekly Schedule Grid (`components/schedules/WeeklySchedule.tsx` or similar):**
  - [ ] Ensure rendering logic handles `'temporary_coverage'` events correctly.
  - [ ] Update tooltips, legends, and badges to reflect "Temporary Coverage".
- [ ] **Filter and View Modes:**
  - [ ] Update any filters that relied on `is_teacher` to use role-based filtering.

## 4. Test Updates

- [ ] **Unit Tests:**
  - [ ] Update mock data in tests to remove `is_teacher` and use `'PERMANENT'`/`'FLEXIBLE'` roles.
  - [ ] Update event mock data to use `'temporary_coverage'`.
  - [ ] Fix any failing unit tests in API routes and components.
- [ ] **Integration/E2E Tests (Playwright):**
  - [ ] Update `scenarios/gold/` Playwright tests to look for "Temporary Coverage" instead of "Flex Assignment" in the UI.
  - [ ] Update test assertions that check for the absence of `is_teacher` toggles.
  - [ ] Ensure the availability tests verify that both Permanent and Flex staff can be assigned to temporary coverage.
