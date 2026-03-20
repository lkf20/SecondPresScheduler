# Data Lifecycle Rules (Draft)

This document defines the authoritative ownership, status transitions, and derived vs stored fields
for the core scheduling entities. It is a living reference for both database invariants and API
write paths.

## Editing database rows

- **Prefer in-place updates.** When implementing edit/update flows, prefer updating the existing row (e.g. SQL `UPDATE` / update by id) rather than deleting and inserting a new row. In-place updates preserve the row id, so audit log entries and foreign-key references elsewhere in the database are not broken. Use delete + create only when the change cannot be expressed as an update (e.g. changing the logical identity of the entity or merging/splitting).

## Coverage Requests

### coverage_requests

- **Owner / Source of Truth:** Created/updated by time-off flows and manual coverage flows.
- **Allowed writers:** `app/api/time-off/*`, `lib/api/coverage-requests.ts`, sub-finder routes.
- **Lifecycle:** `open -> filled -> cancelled` (see status transitions below).
- **Derived vs stored:**
  - **Stored:** `status`, `request_type`, `source_request_id`, `start_date`, `end_date`, `teacher_id`
  - **Derived:** coverage summary counts (computed in dashboard APIs)

### coverage_request_shifts

- **Owner / Source of Truth:** Derived from coverage_requests (and time_off_shifts when request_type = time_off).
- **Allowed writers:** `lib/api/time-off.ts`, sub-finder routes, DB trigger on `time_off_shifts`.
- **Lifecycle:** `active -> cancelled` (see status transitions below).
- **Multi-room:** One `time_off_shift` can correspond to **multiple** active `coverage_request_shifts` (same date/slot, different `classroom_id`) when the absent teacher is a floater across rooms. Rows may set `time_off_shift_id` to the originating `time_off_shifts.id`.
- **Derived vs stored:**
  - **Stored:** `coverage_request_id`, `school_id`, `status`, `date`, `time_slot_id`, `classroom_id`, optional `time_off_shift_id`
  - **Derived:** coverage status / UI labels

### GET coverage-request by absence_id (sub-finder)

- **Behavior:** When a time off request has no linked coverage request yet, GET `/api/sub-finder/coverage-request/[absence_id]` creates the coverage request and then creates **one `coverage_request_shift` per classroom** for each time off shift, using `teacher_schedules` (same school) only; there is **no** "Unknown (needs review)" or other fallback. Inserts set `time_off_shift_id` to the source `time_off_shifts` row.
- **Omitted shifts:** For each (day_of_week_id, time_slot_id), if the teacher has no `teacher_schedules` row in that school with a non-null `classroom_id`, that shift is **omitted** (no row is inserted into `coverage_request_shifts`). The response includes `omitted_shift_count` and `omitted_shifts: Array<{ date, day_of_week_id, time_slot_id }>` so the client can show that some shifts could not be added (e.g. "Add teacher to baseline schedule for those slots").
- **Rationale:** Aligns with the time-off classroom requirement; avoids creating coverage shifts with "Unknown (needs review)" classroom.

### sub_assignments

- **Owner / Source of Truth:** Sub-finder assign flows.
- **Allowed writers:** `app/api/sub-finder/*`, `lib/api/sub-assignments.ts`
- **Lifecycle:** `active -> cancelled` (see status transitions below).
- **Partial assignments (Phase 1):** `is_partial NOT NULL DEFAULT false`. When `is_partial = true`, the assignment covers a portion of the shift (optional `partial_start_time`/`partial_end_time` in HH:mm). A full assignment cancels all existing actives for that shift. A partial is additive (up to 4 per shift); it only cancels any existing full assignment. Coverage weight: full = 1.0, partial = 0.5 (approximation). Two partials ≥ 1.0 → shift is `fully_covered`. Unassigning a specific partial requires `assignment_id` when multiple partials exist.
- **Assign payload contract:** `POST /api/sub-finder/assign-shifts` expects optional partial metadata in `partial_assignments[*].partial_start_time` / `partial_assignments[*].partial_end_time` (not generic `start_time`/`end_time`), and each partial `shift_id` must also be included in `selected_shift_ids`.
- **Read/UI contract:** Assignment read surfaces should preserve partial metadata for display (`is_partial`, optional `partial_start_time`, `partial_end_time`), including `assigned_subs[]` and response summaries like `assigned_shifts`.
- **Read/UI contract (multi-partial names):** Surfaces that render shift chips or shift rows must preserve multi-assignee names (`assigned_sub_names` / `assigned_subs[]`) end-to-end; do not reduce multi-partial coverage to a single `sub_name`.
- **Derived vs stored:**
  - **Stored:** `status`, `coverage_request_shift_id`, `sub_id`, `is_partial`, `partial_start_time`, `partial_end_time`
  - **Derived:** coverage progress indicators (counts, badges, percent-filled); shift `status` (`uncovered` / `partially_covered` / `fully_covered`) via `deriveShiftCoverageStatus` in `lib/schedules/coverage-weights.ts`

### staffing_events / staffing_event_shifts (temporary coverage and reassignment)

- **Owner / Source of Truth:** Temporary coverage and day-only reassignment flows.
- **Allowed writers:** `app/api/staffing-events/*`
- **Lifecycle:** `active -> cancelled`.
- **Derived vs stored:**
  - **Stored:** event metadata (`event_type`, `event_category`, notes, dates) and shift rows (`date`, `time_slot_id`, `classroom_id`, `staff_id`, optional `source_classroom_id`, optional `coverage_request_shift_id`).
  - **Derived:** Weekly schedule rendering after overlay application (source exclusion + target inclusion for reassignment rows).
- **Reassignment-specific rule:** For `event_category = 'reassignment'`, each shift row requires `source_classroom_id` and source/target classrooms must differ.
- **Coverage linkage:** When reassignment is tied to a `coverage_request_shift_id`, write a linked active `sub_assignment` with `assignment_kind = 'absence_coverage'`, `non_sub_override = true`, and `staffing_event_shift_id` set. Cancelling the reassignment shift cancels the linked sub assignment.

## Time Off

### time_off_requests

- **Owner / Source of Truth:** Time-off form + time-off API routes.
- **Allowed writers:** `app/api/time-off/*`, `lib/api/time-off.ts`
- **Lifecycle:** `draft -> active -> cancelled` (see status transitions below).
- **Reason:** Optional for both draft and active requests. When provided, must be one of: Vacation, Sick Day, Training, Other (DB constraint and form enum).
- **Derived vs stored:**
  - **Stored:** `status`, `start_date`, `end_date`, `teacher_id`, `shift_selection_mode`, `reason` (optional)
  - **Derived:** computed shift list for `all_scheduled`

### time_off_shifts

- **Owner / Source of Truth:** Derived from time_off_requests.
- **Allowed writers:** `lib/api/time-off-shifts.ts`
- **Lifecycle:** no status; rows are created/deleted per request update.
- **Derived vs stored:**
  - **Stored:** `date`, `time_slot_id`, `is_partial`, `start_time`, `end_time`
- **School closures:** Shifts are not created for (date, time_slot) when that slot is closed (see `school_closures`: date, time_slot_id, reason, optional notes). Time off POST/PUT filter requested shifts using `getSchoolClosuresForDateRange` and `isSlotClosedOnDate` so no time_off_shifts or coverage_request_shifts are created for closed days. In UIs where users pick shifts (Time Off form, Assign Sub panel), closed shifts may be shown for context but must be marked "School closed" and must not be selectable or assignable; sub assignment and temporary coverage (flex) APIs reject assignment to closed shifts (e.g. assign-shifts returns 409).

### Dashboard and time off

- **Dashboard "Upcoming Time Off & Coverage"** shows only **active** time off requests. Coverage requests whose source `time_off_request` has `status = 'draft'` are excluded from the dashboard overview API response.

### Time off overlap rule

- **No overlapping time off (draft or active) per teacher.** Overlap = same teacher and at least one (date, time_slot_id) in common with another draft or active request.
- **Enforcement:** Before creating (POST) or updating (PUT) a time off request, the API calls `findOverlappingTimeOffRequest`. If an overlap is found, the API returns **409 Conflict** with a JSON body the client uses to show a resolution modal: `code: 'TIME_OFF_OVERLAP'`, `existingRequestId`, `existingStartDate`, `existingEndDate`, `existingStatus` (`'draft' | 'active'`), `teacherName`, `newRequestStartDate`, `newRequestEndDate`, `overlapStartDate`, `overlapEndDate`.
- **Client:** On 409 with `TIME_OFF_OVERLAP`, the form shows a modal offering "Edit existing request" (navigate to that request) or "Cancel new request". If the existing request is a draft, the modal copy says "draft time off request".

### Time off classroom requirement

- **Every time off shift must have a scheduled classroom.** Coverage and sub-finder need a real classroom for each shift; we do not create time off for slots where the teacher has no baseline schedule row with a classroom in the same school.
- **Enforcement (API):** Before creating (POST) or updating (PUT) a time off request, when there are shifts to create, the API calls `validateShiftsHaveClassroom(teacherId, schoolId, shifts)`. For each (day_of_week_id, time_slot_id) in the request, there must be at least one `teacher_schedules` row for that teacher and school with a non-null `classroom_id`. If any shift is missing, the API returns **400 Bad Request** with `code: 'SHIFTS_MISSING_CLASSROOM'`, an `error` message directing the user to add the teacher to the baseline schedule (Settings → Baseline Schedule) or remove those shifts, and `missingShifts: Array<{ day_of_week_id, time_slot_id }>`.
- **Enforcement (DB trigger):** The trigger `auto_create_coverage_request_shift_from_time_off_shift` runs AFTER INSERT on `time_off_shifts`. When it creates a row in `coverage_request_shifts`, it resolves `classroom_id` from `teacher_schedules` (same school) only; there is **no** "Unknown (needs review)" fallback. If no classroom can be resolved, the trigger **raises an exception** (ERRCODE P0001), which aborts the transaction so the `time_off_shift` insert is rolled back. This keeps the DB consistent with the "no Unknown" policy and protects against direct inserts that bypass the API (migration 104).
- **Rationale:** Prevents creating coverage_request_shifts with "Unknown (needs review)" classroom and keeps sub-finder and assign flows unambiguous.

## Status Transition Rules (Code-Enforced)

These are enforced in API routes using `lib/lifecycle/status-transitions.ts`.

- **time_off_requests.status**
  - allowed: `draft -> active`, `draft -> cancelled`, `active -> cancelled`
- **coverage_requests.status**
  - allowed: `open -> filled`, `open -> cancelled`, `filled -> cancelled`
- **coverage_request_shifts.status**
  - allowed: `active -> cancelled`
- **sub_assignments.status**
  - allowed: `active -> cancelled`

## Teacher Schedule Updates & Data Integrity

When a teacher's baseline schedule is updated or removed, the API enforces strict rules to maintain data integrity for dependent future events (`time_off_requests`, `coverage_request_shifts`, and `sub_assignments`).

1. **Safe Sync (Classroom changes only):** If a baseline update only changes the `classroom_id` (teacher, day and time slot remain the same), the system automatically syncs the new classroom to all dependent `coverage_request_shifts` and `sub_assignments` where `date >= today`.
2. **Block & Resolve (Structural changes):** If a baseline schedule is deleted, or its `teacher_id`, `day_of_week_id`, or `time_slot_id` is changed, the API returns a 409 Conflict if the _current_ teacher has any dependent future events (`date >= today`) for that slot. The user must manually cancel or resolve those future events before making the change. (Changing `teacher_id` would orphan the current teacher’s future time off/coverage/subs for that slot.)
3. **Frozen History:** Past events (`date < today`) are historically immutable. No baseline schedule updates will ever cascade or alter `classroom_id` on shifts that have already occurred.
4. **Data Health Safety Net:** The app monitors for "Orphaned Shifts" (future shifts that somehow lost their baseline schedule or fall on a newly scheduled closed day) and flags them for manual review rather than relying on dangerous automated cascading deletes.

**Definition of "today":** Past vs present/future uses the shift `date` compared to "today." Currently "today" is the server’s local date (`getTodayISO()` in `lib/utils/date.ts`). School timezone may be introduced later for stricter school-date semantics; any such change should use a single shared "school today" in dependency checks, sync logic, and data-health.

## Notes

- If a status transition is rejected, the API should return 400 with a clear error.
- Any new write path should add a one-line reference:
  - `// See docs/domain/data-lifecycle.md: <table> lifecycle`
- Rows are never hard-deleted for lifecycle reasons; cancellations are modeled via status except for pure projection tables (time_off_shifts).
- Cancelling a time_off_request does not automatically cancel existing sub_assignments; the user must explicitly cancel or convert them to extra coverage.
- Invariant: source_request_id is required for request_type = time_off and extra_coverage.

## Anti-patterns

- Do not update derived fields directly.
- Do not update status without using a transition helper.

## PR Review Checklist (Lifecycle)

- Any new/modified write path links this doc.
- Status changes use transition helpers with 400 on invalid transitions.
- Derived values are computed, not persisted.
