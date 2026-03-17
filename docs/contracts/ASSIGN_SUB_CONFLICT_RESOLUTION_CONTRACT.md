# Assign Sub Conflict Resolution Contract

**Use this contract when implementing or changing Assign Sub panel conflict resolution, the assign-shifts API, or sub assignment database logic.** It defines invariant rules and documents each conflict type, resolution options, and corresponding database updates.

## Invariant Rules

### Rule 1: One sub per classroom shift (unless floater)

**A sub cannot be assigned to two classrooms during the same timeslot unless they are a floater.**

- **Scope:** Same `(sub_id, date, time_slot_id)`.
- **Enforcement:** `POST /api/sub-finder/assign-shifts` loads the sub's active `sub_assignments` for the selected dates and time slots (`subScheduleCollisions`). If any selected shift overlaps (same date + time_slot_id) and does **not** have a resolution (`floater` or `move`), the API returns **409** with: `"Double booking prevented: this sub already has an active assignment for one or more selected shifts."`
- **Exception:** When the user selects `floater` or `move` resolution for that shift, the conflict is resolved and the assignment proceeds.
- **DB:** See [sub-assignment-integrity.md](../sub-assignment-integrity.md). A partial unique index can enforce this at the DB level; currently enforcement is in the API.

### Rule 2: One full sub per coverage shift; up to 4 partial subs

**A full (non-partial) sub assignment is exclusive per `coverage_request_shift_id`. Partial assignments are additive (up to a cap of 4).**

- **Full assignments:** Only one active `sub_assignment` with `is_partial = false` per `coverage_request_shift_id` where `status = 'active'`. Inserting a full assignment cancels ALL existing active assignments for that shift (both full and partial).
- **Partial assignments (Phase 1):** Multiple partial subs are allowed for the same shift (maximum 4). A partial assignment cancels any existing full assignment for that shift but does not affect other partial assignments.
- **DB enforcement:** Conditional unique index `idx_sub_assignments_one_active_full_per_shift` on `(coverage_request_shift_id) WHERE status = 'active' AND is_partial = false` enforces full-assignment exclusivity at the DB level.
- **API:** `POST /api/sub-finder/assign-shifts` accepts an optional `partial_assignments` array (`[{shift_id, partial_start_time?, partial_end_time?}]`). Shifts in `partial_assignments` are assigned as partial (`is_partial = true`). Remaining shifts in `selected_shift_ids` are full. Validation: no floater+partial combination; no duplicate shift_ids; time values must be HH:mm; cap of 4 partials per shift.

### Rule 3: Floater allows same slot, different classrooms

When `is_floater = true`, a sub can have multiple active `sub_assignments` for the same `(date, time_slot_id)` but different classrooms. Each counts 0.5 toward coverage. This is the only allowed "double booking" for a sub in the same timeslot.

---

## Conflict Types and Resolution Flows

The Assign Sub panel (`AssignSubPanel.tsx`) and Sub Finder surface several conflict scenarios. Each has a Conflict banner with resolution options. The table below maps conflict type → resolution options → database logic.

| Conflict Type                        | Description                                                                                           | Resolution Options                                                                                             | Database Update Logic                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **conflict_sub**                     | Sub is already assigned as a sub in another room (another sub shift) for the same date/time.          | Do not assign; Assign as Floater; Move sub here (remove from other room)                                       | See [conflict_sub](#conflict_sub)                     |
| **conflict_teaching**                | Sub has a teaching schedule (baseline in `teacher_schedules`) in another room for the same date/time. | Do not assign; Assign as Floater; Move sub here (remove from other room)                                       | See [conflict_teaching](#conflict_teaching)           |
| **Already covered by different sub** | Shift already has an assigned sub (different from the one selected).                                  | Replace with selected sub (remove current sub); Do not assign                                                  | See [replace sub](#replace-sub)                       |
| **Already covered by selected sub**  | Shift already has an assigned sub (same as selected).                                                 | Remove sub (no assign)                                                                                         | See [remove sub](#remove-sub)                         |
| **Replace + Conflict (combined)**    | Shift has a different sub (e.g. Victoria) AND selected sub has a conflict (already in another room).  | Do not assign; Remove [current sub] and mark [selected sub] as Floater; Move sub here (remove from other room) | See [replace + conflict](#replace--conflict-combined) |

---

## Replace + Conflict (combined)

**Condition:** Shift has an active `sub_assignment` (assigned_sub_id ≠ selected sub_id) **and** the selected sub has a conflict (conflict_sub or conflict_teaching—already assigned elsewhere during that time). User must both replace the current sub and resolve the selected sub's double-booking.

**Conflict message:** When both apply, the panel shows a combined banner: _"This shift is assigned to [current sub]. [Selected sub] is already assigned elsewhere during this time. To assign here, replace [current sub] and choose how to resolve the conflict."_

### Resolution Options

1. **Do not assign this shift** — No DB change.
2. **Remove [current sub] and mark [selected sub] as Floater (covers both rooms, 0.5 each)** — Cancel current sub; update selected sub's existing assignment to `is_floater = true`; insert new assignment with `is_floater = true`.
3. **Move sub here (remove sub from other room)** — Cancel current sub; cancel selected sub's assignment in the other room; insert new assignment here (full).

### Database Logic

Same as conflict_sub / conflict_teaching; the assign-shifts API (1) cancels existing assignments for the coverage_request_shift_ids being assigned (replace), then (2) applies floater or move resolution for the selected sub's collision. Both operations occur in a single assign-shifts call when `resolutions` includes `floater` or `move` for the relevant shift ids.

**UX:** The row is enabled only when the user selects Floater or Move. Plain "Replace" (without conflict resolution) cannot be used when the selected sub has a conflict—the API would reject with 409 (double booking). The panel never shows the simple Replace banner when `hasConflict` is true; it shows the conflict banner with combined copy when both `coveredByOtherSub` and `hasConflict`.

---

## conflict_sub

**Condition:** Sub has an active `sub_assignment` in another classroom for the same `(date, time_slot_id)`.

**Conflict message:** `"This sub is already assigned elsewhere."` or the API's `conflict_message` (e.g. `"Conflict: Assigned to sub for [teacher] in [classroom]"`).

### Resolution Options

1. **Do not assign this shift** — No DB change. Shift remains unselected.
2. **Assign as Floater (sub covers both rooms, 0.5 each)** — Sub stays in both rooms; both assignments count 0.5.
3. **Move sub here (remove sub from other room)** — Sub is removed from the other room and assigned here.

### Database Logic

| Resolution    | Action                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Do not assign | No API call; shift not in `selected_shift_ids`.                                                                                             |
| Floater       | Existing `sub_assignment` is updated: `is_floater = true`. New `sub_assignment` is inserted with `is_floater = true`.                       |
| Move          | Existing `sub_assignment` is updated: `status = 'cancelled'`. New `sub_assignment` is inserted with `is_floater = false` (full assignment). |

**API:** `POST /api/sub-finder/assign-shifts` with `resolutions: { [coverage_request_shift_id]: 'floater' | 'move' }`. The API loads `subScheduleCollisions` (sub's active assignments for selected dates/slots), matches by `(date, time_slot_id)`, and either updates existing to `is_floater: true` (floater) or cancels existing (move) before inserting the new assignment.

---

## conflict_teaching

**Condition:** Sub has a `teacher_schedules` row (baseline teaching assignment) in another classroom for the same `(date, time_slot_id)`. No `sub_assignment` exists for that slot—the conflict is from baseline.

**Conflict message:** `"Sub is assigned to [classroom name] during this time."`

### Resolution Options

1. **Do not assign this shift** — No DB change.
2. **Assign as Floater (sub covers both rooms, 0.5 each)** — Sub keeps their teaching schedule; new sub_assignment is created with `is_floater = true` so they count 0.5 here and their teaching schedule remains.
3. **Move sub here (remove sub from other room)** — We **cannot** remove the sub from their teaching schedule (that would require editing the baseline). We create a full `sub_assignment` here (`is_floater = false`). The sub will appear in both places (teaching + sub) until baseline is changed manually.

### Database Logic

| Resolution    | Action                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Do not assign | No API call.                                                                                                                      |
| Floater       | New `sub_assignment` inserted with `is_floater = true`. No change to `teacher_schedules`.                                         |
| Move          | New `sub_assignment` inserted with `is_floater = false`. No change to `teacher_schedules`—baseline is not modified by Assign Sub. |

**Note:** "Move" for conflict_teaching does not literally remove the sub from the other room; it assigns them fully here. The label "Move sub here (remove sub from other room)" reflects user intent. Actual removal from the teaching room requires a baseline schedule edit.

---

## Replace Sub (already covered by different sub)

**Condition:** Shift has an active `sub_assignment` (assigned_sub_id ≠ selected sub_id). User wants to replace the current sub with the selected sub.

**Conflict message:** Conflict-style banner: `"This shift is assigned to [current sub]. Replace with [selected sub]?"`

### Resolution Options

1. **Do not assign this shift** — No DB change.
2. **Replace with [selected sub] (remove [current sub])** — Current sub is unassigned; selected sub is assigned.

### Database Logic

| Resolution    | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do not assign | No API call.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Replace       | 1. `POST /api/sub-finder/unassign-shifts`: Cancel existing `sub_assignment` for that `coverage_request_shift_id` (scope `single`, `assignment_id` or `coverage_request_shift_id`). 2. `POST /api/sub-finder/assign-shifts`: Insert new `sub_assignment` for selected sub. Alternatively, the assign-shifts API's "replace" logic cancels existing assignments for `coverage_request_shift_id`s in the payload before inserting, so a single assign-shifts call with the shift in `selected_shift_ids` may suffice if the payload includes the shift. |

**Assign Sub panel:** When user selects "Replace," the shift is added to `selectedShiftIds` and `replaceResolutions[slotKey] = true`. On Assign, the assign-shifts API receives the shift and cancels any existing assignment for that `coverage_request_shift_id` before inserting (see Rule 2).

---

## Remove Sub (already covered by selected sub)

**Condition:** Shift has an active `sub_assignment` and the assigned sub is the **same** as the selected sub. User wants to remove the sub from this shift.

**Conflict message:** None—this is not a "conflict" but a "currently assigned to you" state. UI shows only **Remove sub** button.

### Resolution Options

1. **Remove sub** — Unassign the sub from this shift.

### Database Logic

| Resolution | Action                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove sub | `POST /api/sub-finder/unassign-shifts` with `absence_id` (time_off_request_id), `sub_id`, `scope: 'single'`, `assignment_id`. API updates `sub_assignments.status = 'cancelled'` for that assignment. |

**Assign Sub panel:** `handleRemoveSubConfirm` calls unassign-shifts, then `fetchShifts()` to refresh. Row updates: no teacher chip, checkbox re-enabled, gray background removed.

---

---

## Phase 1 Partial Assignments

**Added in migration 117.** Allows multiple subs to cover portions of a single absence shift.

### Key rules

- `is_partial` is NOT NULL (migration normalized to `false` for all existing rows).
- A shift can have up to **4 active partial assignments** (Phase 1 cap; enforced in API).
- A full assignment and partial assignments cannot coexist on the same shift.
- Coverage weight: full = 1.0, partial = 0.5 (approximation; Phase 2 will use time-based logic). Two partials ≥ 1.0 → shift is `fully_covered`.
- UI shows `(approx.)` label wherever partial coverage counts are displayed.

### check-conflicts response (new flags)

`POST /api/sub-finder/check-conflicts` now includes per-shift boolean flags in the response:

| Field                           | Description                                                         |
| ------------------------------- | ------------------------------------------------------------------- |
| `has_existing_partial_coverage` | `true` if the target shift already has ≥1 active partial assignment |
| `can_add_partial`               | `true` if no full assignment exists AND partial count < 4           |

These flags are derived from the **target shift's** active assignments, independent of the candidate sub's own conflicts.

### Conflict resolution updates

- `coveredByOtherSub` in `AssignSubPanel` is only `true` when another sub has a **full** assignment OR the partial cap is reached. Shifts with partial-only coverage that haven't hit the cap are NOT blocked — the director can add another partial.
- When a shift is `partially_covered` in `ContactSubPanel`, `assignedElsewhere` is NOT set — the sub can be added as another partial. The card shows amber border and "Partially covered — adding as partial" label.

### Unassign with multiple partials

`POST /api/sub-finder/unassign-shifts` with `scope: 'single'` requires `assignment_id` when the target shift has multiple active assignments (returns 400 if not provided). This prevents accidental removal of the wrong partial.

## Summary of Database Tables

| Table                     | Relevant columns                                                                                                                              | Used for                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `sub_assignments`         | `sub_id`, `date`, `time_slot_id`, `coverage_request_shift_id`, `status`, `is_floater`, `is_partial`, `partial_start_time`, `partial_end_time` | Sub assignments; conflict detection; replace/cancel/partial |
| `coverage_request_shifts` | `id`, `coverage_request_id`, `date`, `time_slot_id`, `classroom_id`                                                                           | Target shifts for assignment                                |
| `teacher_schedules`       | `teacher_id`, `day_of_week_id`, `time_slot_id`, `classroom_id`                                                                                | conflict_teaching detection (sub's teaching schedule)       |

---

## References

- [sub-assignment-integrity.md](../sub-assignment-integrity.md) — Server/DB rules, constraint recommendations
- [SCHEDULE_SEMANTICS_CONTRACT.md](./SCHEDULE_SEMANTICS_CONTRACT.md) — Conflict handling invariants
- [data-lifecycle.md](../domain/data-lifecycle.md) — sub_assignments lifecycle
- `app/api/sub-finder/assign-shifts/route.ts` — Assign-shifts API implementation
- `app/api/sub-finder/check-conflicts/route.ts` — Conflict detection (conflict_teaching, conflict_sub)
- `components/assign-sub/AssignSubPanel.tsx` — Conflict banner UI and resolution flow
