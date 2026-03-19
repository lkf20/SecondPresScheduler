# Day-Only Reassignment Contract

Use this contract when implementing or changing day-only reassignment behavior.

## Purpose

Day-only reassignment lets directors move an existing baseline staff member from a source classroom
to a target classroom for a specific date/time slot without creating a fake absence.

When linked to an absence shift, reassignment must also satisfy coverage so the absence appears covered.

## Core Invariants

1. Reassignment is an overlay, not a baseline edit.

- Baseline `teacher_schedules` is never mutated by reassignment writes.
- Reassignment applies only to explicit date/slot rows.

2. A reassigned staff member cannot be active in two rooms for the same date/slot.

- Enforced by existing unique active rule on `staffing_event_shifts`:
  `(school_id, staff_id, date, time_slot_id) WHERE status = 'active'`.

3. Source and target classrooms must differ.

- `source_classroom_id != classroom_id` for reassignment rows.

4. School scope and closure rules apply.

- All reads/writes must be scoped by `school_id`.
- Reassignment cannot be created on closed date/slot.

5. Lifecycle is cancellation-based.

- Reassignment rows transition `active -> cancelled`.
- No hard delete for lifecycle entities.

6. Coverage linkage is explicit.

- If a reassignment is intended to cover a specific absence shift, the reassignment row must carry
  `coverage_request_shift_id` and create a linked active `sub_assignment` with
  `assignment_kind = 'absence_coverage'` and `non_sub_override = true`.
- Cancelling the reassignment shift cancels the linked `sub_assignment`.

## Data Model Contract

## `staffing_event_shifts` (new reassignment fields)

- `source_classroom_id UUID NULL REFERENCES classrooms(id)`
- `coverage_request_shift_id UUID NULL REFERENCES coverage_request_shifts(id)`

Rules:

- `source_classroom_id` is required for `event_category = 'reassignment'`.
- `coverage_request_shift_id` is optional. If set, it must match the reassignment shift identity
  (same date/time slot/target classroom).

## `sub_assignments` linkage

- `staffing_event_shift_id UUID NULL REFERENCES staffing_event_shifts(id)`

Rules:

- Set for linked reassignment coverage rows created from reassignment flow.
- `staffing_event_shift_id` must not be reused across multiple active reassignment-linked assignment rows.

## API Contract (Phase 1 backend)

`POST /api/staffing-events/flex`

Accepted reassignment payload additions:

- `event_category: 'reassignment'`
- top-level optional: `source_classroom_id`, `coverage_request_shift_id`
- per-shift optional: `source_classroom_id`, `coverage_request_shift_id`

Validation:

- for `event_category = 'reassignment'`, each created shift row must have `source_classroom_id`.
- source != target classroom.
- if `coverage_request_shift_id` is provided, the coverage shift must belong to the same school,
  be active, and match date/time slot/target classroom.

Side effects:

- insert `staffing_event_shifts` reassignment row(s).
- if `coverage_request_shift_id` present, insert linked `sub_assignments` row(s) and set
  `staffing_event_shift_id`.

`POST /api/staffing-events/flex/remove`

Cancellation behavior:

- cancel selected `staffing_event_shifts`.
- cancel active linked `sub_assignments` by `staffing_event_shift_id`.
- if no active shifts remain for event, set `staffing_events.status = 'cancelled'`.
- reverse cleanup: when a linked reassignment `sub_assignment` is cancelled directly (e.g. Remove Sub),
  cancel the linked `staffing_event_shift`; if that was the event's last active shift, cancel the parent
  `staffing_events` row.

## Weekly Schedule Read Contract

For each `(date, time_slot_id, classroom_id)` cell:

1. Start with baseline teachers.
2. Apply reassignment exclusions:

- remove teachers where active reassignment exists with matching date/slot and
  `source_classroom_id = classroom_id`.

3. Apply reassignment additions:

- include reassigned teacher where active reassignment row has `classroom_id = classroom_id`.

4. Preserve existing sub/floater/flex behavior.

Outcome:

- Reassigned teacher appears only once in target classroom for that date/slot (as the linked sub row when coverage-linked; do not also render as Temporary Coverage in the same target cell).
- Source classroom keeps a contextual marker for the moved staff member (`Reassigned *`) so directors can see day-only removal without recording a time-off absence.

## Conflict Resolution Contract Integration

In Assign Sub / Sub Finder conflict flows, baseline-teaching collision may resolve with:

- `reassign`: move baseline staff to target for this shift only.

Copy guidance:

- “Reassign staff here (staff will be removed from baseline assignment for this shift only).”

## Audit Log Contract Additions

Category/entity:

- `category = 'temporary_coverage'`
- `entity_type = 'staffing_event'`

Required details for reassignment assign:

- `staff_id`, `teacher_name`
- `source_classroom_id`, `source_classroom_name`
- `classroom_id`, `classroom_name`
- `date`, `time_slot_id`, `time_slot_code`
- `coverage_request_shift_id` when linked
- `linked_sub_assignment_count`

Required details for reassignment cancel:

- `scope`, `removed_count`, `remaining_active_shifts`
- `linked_sub_assignment_cancelled_count`

## UI Display Contract (Phase 2 UI)

- Reassignment must be visually distinct from absence and substitute assignment.
- Shift chips/status rows should use explicit “Reassigned” semantics (icon + label) where shown.
- Legends must be updated when reassignment visuals are introduced.
- Weekly schedule `Absences` chip/counts should continue to represent true absences only (do not increment from reassignment markers).
- Today's Schedule (screen + PDF) legend must include `Reassigned *` when absences/subs are shown. The strikethrough applies to `Reassigned` only; `*` remains unstruck.
- Today's Schedule cells must render reassigned source staff as `Name *`, with strikethrough on `Name` only (and keep true absences as strikethrough without the asterisk).

## Non-goals (this phase)

- No baseline schedule mutation.
- No payroll/timekeeping semantics.
- No interval-precise reassignment math beyond current shift-slot model.
