# Scheduler App - TODO Tracker

This document tracks items to update, fix, or implement in the Scheduler App.

## How to Use

- Add new items to the appropriate category section below
- Mark completed items with ✅
- Move items between categories as priorities change
- Use the checkbox format `- [ ]` for easy tracking

---

## 🐛 Bug

Issues that need to be fixed.

- [ ] Handle duplicate display names - determine what to do when multiple staff members have the same display name
- [ ] Fix timezone issue causing dates to shift by one day in sub finder (dates stored as DATE type are being parsed as UTC, causing day shift in local timezones)
- [ ] After assigning selected shifts, getting an assign shifts error sometimes
- [ ] Add validation to prevent multiple subs from being assigned to the same classroom/slot/teacher combination - need better error controls and logic around how many subs can be assigned to a single shift
- [ ] Investigate Sub Finder intermittently showing "No recommended subs found" after navigating away and back (repro: Kim B. Jan 19-23)
- [ ] Time Off cancel flow: ensure coverage_requests + shifts are re-opened when time_off_requests go back to active; add cancel dialog when subs exist to choose remove vs keep (keep => extra_coverage)
- [ ] Time Off cancel flow: prevent cancelling the same time off request twice and ensure Activity Log does not record duplicate cancel entries

---

## 🚀 Near Term Feature

Features to implement soon (within the next few weeks).

- [ ] Before real data: create dedicated Test School in prod and optional read-only mode for non-test tenants
- [ ] Ensure layout consistency in Weekly Schedule page - add w-full max-w-4xl wrapper to match Dashboard and Time Off page structure for consistent spacing between navigation panel and main content
- [ ] Add summary text of who has already been assigned to sub in Sub Finder under (for example) "3 of 5 Shifts Require Subs"
- [ ] Add option to view absences in Sub Finder left rail that are already covered
- [ ] Display name options - offer display name format options (e.g., "First Name Last Initial") with ability to apply to all staff or just the current instance
- [ ] Dashboard background refresh - refresh coverage summary every 60-120 seconds and show a subtle "Last updated" timestamp with a small manual refresh option
- [ ] Dashboard time range setting - add a Settings option to configure how far ahead the dashboard looks (e.g., 2 weeks, 3 weeks)
- [ ] Dashboard time horizon control - allow changing the dashboard’s upcoming window directly within the dashboard (e.g., switch from 2 weeks to 3 weeks)
- [x] Create profile entry for current user - manually create profile entry linking auth user to school (needed for testing audit logging and override functionality) ✅ Added API endpoint and UI page at /setup/profile
- [ ] Enhanced profile creation UI - create thorough profile creation process where users add their name, select a role, choose/assign school, and provide other necessary information (expand beyond the basic auto-creation)
- [ ] User onboarding UI - create UI flow for onboarding new users, collecting necessary information (name, role, school assignment)
- [ ] School management UI - add ability to create new schools and manage school settings
- [ ] Timezone settings - add timezone configuration section to Settings to allow schools to set their timezone, ensuring dates are displayed and processed correctly
- [ ] Standardize warning styles - add a shared WarningText component and migrate existing warnings to it (Time Off, Weekly Schedule, Sub Finder, etc.)
- [ ] Check and fix UI for different screen sizes - some UI errors noticed in Dashboard for medium size screens
- [ ] Add tooltip to Understaffed Classrooms summary card icons
- [ ] Decide on formatting for Below Required pill in Below Staffing Target section
- [ ] Count understaffed classrooms by slot rather than by classroom
- [ ] Change where Update Sub button directs you to
- [ ] Add tooltip to Covered badge to see subs and shifts
- [ ] Add tooltip to Uncovered badge to see shifts
- [ ] Add borders/shading to shifts in Upcoming Time Off to match Uncovered and Covered pills
- [ ] Enrollments: add classroom_id (or clarify model) and wire write UI/API for per-class-group enrollment
- [ ] Performance: review query plans and tailor indexes to actual slow queries before launch
- [ ] Mobile navigation: design and implement a mobile-friendly global nav pattern (current left rail is not usable on small screens)
- [ ] Mobile UX: comprehensive pass to make all pages mobile friendly (navigation, layouts, and responsive interactions)
- [ ] Add Flex staff to Daily Schedule and to Weekly Schedule. Update Flex staff database logic.
- [ ] Standardize filter styles to match Time Off chips across the app (Staff, Sub Finder, etc.)
- [ ] Enable Skills category in Staff Qualifications once skill tracking UI is ready
- [ ] Re-enable "Infant qualified" certification when ready

---

## 🔮 Future Feature

Features for later consideration (beyond the next few weeks).

- [ ] For each section of the weekly schedule side panel, add ability to apply to every day or every time slot
- [ ] Create multiple baseline weekly schedules (e.g., Spring 2026 Schedule) and see a history of weekly schedules
- [ ] Specify enrollment by class grouping (e.g., Toddler A (2), Toddler B (3)) instead of a single enrollment value
- [ ] Preserve application state when navigating between sections - maintain user context (e.g., selected absence, sub finder filters, selected shifts) when switching to dashboard or other sections and returning, so users don't lose their work in progress
- [ ] Add AI chat assistant for coverage planning; keep coverage/assignment logic in reusable server functions and make "find sub"/"assign shifts" deterministic and explainable so the AI can justify choices
- [ ] Mobile UX overhaul: create a global mobile-friendly navigation pattern and adjust Sub Finder layout/flows to use it
- [ ] Sub Finder: detect partial-shift availability and classify subs into the "Partially Available" section
- [ ] Create reusable FilterChip component and standardize filter styles across the app

### API Enhancements for AI Chat (Phase 3)

- [ ] Add advanced filtering to unified `/api/time-off-requests` endpoint (query builder pattern for complex filters)
- [ ] Add pagination and cursor-based navigation to unified API
- [ ] Add field selection (sparse fieldsets) to reduce payload sizes
- [ ] Add caching layer for coverage calculations (Redis or in-memory cache with TTL)
- [ ] Add rate limiting to unified API endpoints

### Future API Optimizations (Phase 4)

- [ ] Consider GraphQL implementation if query complexity grows significantly
- [ ] Add real-time updates (WebSocket or Server-Sent Events) for live coverage changes
- [ ] Add analytics endpoints for coverage trends and patterns

---

## 🧪 Testing

Test cases to add or testing improvements.

- [x] Add tests for handling deleting or deactivating class groups, classrooms, teachers, and subs

---

## Completed Items

Items that have been finished (moved here for reference).

<!-- Move completed items here and mark with ✅ -->

---

## Notes

_Add any additional notes, context, or reminders here._
