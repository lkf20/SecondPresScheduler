# Data Lifecycle Rules (Draft)

This document defines the authoritative ownership, status transitions, and derived vs stored fields
for the core scheduling entities. It is a living reference for both database invariants and API
write paths.

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

### Dashboard and time off

- **Dashboard "Upcoming Time Off & Coverage"** shows only **active** time off requests. Coverage requests whose source `time_off_request` has `status = 'draft'` are excluded from the dashboard overview API response.

### Time off overlap rule

- **No overlapping time off (draft or active) per teacher.** Overlap = same teacher and at least one (date, time_slot_id) in common with another draft or active request.
- **Enforcement:** Before creating (POST) or updating (PUT) a time off request, the API calls `findOverlappingTimeOffRequest`. If an overlap is found, the API returns **409 Conflict** with a JSON body the client uses to show a resolution modal: `code: 'TIME_OFF_OVERLAP'`, `existingRequestId`, `existingStartDate`, `existingEndDate`, `existingStatus` (`'draft' | 'active'`), `teacherName`, `newRequestStartDate`, `newRequestEndDate`, `overlapStartDate`, `overlapEndDate`.
- **Client:** On 409 with `TIME_OFF_OVERLAP`, the form shows a modal offering "Edit existing request" (navigate to that request) or "Cancel new request". If the existing request is a draft, the modal copy says "draft time off request".

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
