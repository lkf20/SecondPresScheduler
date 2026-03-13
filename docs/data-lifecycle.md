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
- **Allowed writers:** `lib/api/time-off.ts`, sub-finder routes.
- **Lifecycle:** `active -> cancelled` (see status transitions below).
- **Derived vs stored:**
  - **Stored:** `coverage_request_id`, `school_id`, `status`, `date`, `time_slot_id`, `classroom_id`
  - **Derived:** coverage status / UI labels

### GET coverage-request by absence_id (sub-finder)

- **Behavior:** When a time off request has no linked coverage request yet, GET `/api/sub-finder/coverage-request/[absence_id]` creates the coverage request and then creates `coverage_request_shifts` from the time off shifts. Classroom is resolved from `teacher_schedules` (same school) only; there is **no** "Unknown (needs review)" or other fallback.
- **Omitted shifts:** For each (day_of_week_id, time_slot_id), if the teacher has no `teacher_schedules` row in that school with a non-null `classroom_id`, that shift is **omitted** (no row is inserted into `coverage_request_shifts`). The response includes `omitted_shift_count` and `omitted_shifts: Array<{ date, day_of_week_id, time_slot_id }>` so the client can show that some shifts could not be added (e.g. "Add teacher to baseline schedule for those slots").
- **Rationale:** Aligns with the time-off classroom requirement; avoids creating coverage shifts with "Unknown (needs review)" classroom.

### sub_assignments

- **Owner / Source of Truth:** Sub-finder assign flows.
- **Allowed writers:** `app/api/sub-finder/*`, `lib/api/sub-assignments.ts`
- **Lifecycle:** `active -> cancelled` (see status transitions below).
- **Derived vs stored:**
  - **Stored:** `status`, `coverage_request_shift_id`, `sub_id`
  - **Derived:** coverage progress indicators (counts, badges, percent-filled)

## Time Off

### time_off_requests

- **Owner / Source of Truth:** Time-off form + time-off API routes.
- **Allowed writers:** `app/api/time-off/*`, `lib/api/time-off.ts`
- **Lifecycle:** `draft -> active -> cancelled` (see status transitions below).
- **Derived vs stored:**
  - **Stored:** `status`, `start_date`, `end_date`, `teacher_id`, `shift_selection_mode`
  - **Derived:** computed shift list for `all_scheduled`

### time_off_shifts

- **Owner / Source of Truth:** Derived from time_off_requests.
- **Allowed writers:** `lib/api/time-off-shifts.ts`
- **Lifecycle:** no status; rows are created/deleted per request update.
- **Derived vs stored:**
  - **Stored:** `date`, `time_slot_id`, `is_partial`, `start_time`, `end_time`
- **School closures:** Shifts are not created for (date, time_slot) when that slot is closed (see `school_closures`: date, time_slot_id, reason, optional notes). Time off POST/PUT filter requested shifts using `getSchoolClosuresForDateRange` and `isSlotClosedOnDate` so no time_off_shifts or coverage_request_shifts are created for closed days.

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

1. **Safe Sync (Classroom changes only):** If a baseline update only changes the `classroom_id` (day and time slot remain the same), the system automatically syncs the new classroom to all dependent `coverage_request_shifts` and `sub_assignments` where `date >= today`.
2. **Block & Resolve (Structural changes):** If a baseline schedule is deleted, or its `day_of_week_id` or `time_slot_id` is changed, the API returns a 409 Conflict if any dependent future events (`date >= today`) exist for that slot. The user must manually cancel or resolve these future events first.
3. **Frozen History:** Past events (`date < today`) are historically immutable. No baseline schedule updates will ever cascade or alter `classroom_id` on shifts that have already occurred.
4. **Data Health Safety Net:** The app monitors for "Orphaned Shifts" (future shifts that somehow lost their baseline schedule or fall on a newly scheduled closed day) and flags them for manual review rather than relying on dangerous automated cascading deletes.

## Notes

- If a status transition is rejected, the API should return 400 with a clear error.
- Any new write path should add a one-line reference:
  - `// See docs/data-lifecycle.md: <table> lifecycle`
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
