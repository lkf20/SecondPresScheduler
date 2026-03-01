# Schedule Semantics Contract

**Use this contract when changing Weekly Schedule, Baseline Schedule, or related API/data logic.** It defines invariants so that “baseline + overlays” and editing behavior stay consistent and safe.

## Purpose

- **Baseline is foundational:** Permanent + flex staff define structural staffing; sub assignments and time off are overlays. The weekly view must reflect this model without silent overwrites or inconsistent state.
- **Status reflects reality:** Staffing state (understaffed / OK / surplus) and “confirmed” assignments must match the data; no silent mismatches.
- **Editing is explicit:** Commit = persist; cancel = discard. No partial writes or half-saved state.

## Invariants

### 1. Baseline + overlays

- **Weekly schedule data:** The data used to render the weekly grid must be derivable as: baseline assignments (permanent + flex for the structural slots) plus overlay data (sub assignments, time off, flex events for date ranges). Overlays do not replace baseline; they layer on top.
- **No silent overwrite:** Adding or updating an overlay (e.g. sub assignment, flex assignment) must not silently remove or overwrite baseline assignments. Baseline changes (e.g. unassign teacher) are explicit user actions.
- **Single source of truth:** For a given (school, classroom, day, time_slot, date where applicable), the system has one coherent notion of “who is assigned”; conflicting assignments must be detected and resolved via the conflict flow, not by overwriting without user choice.

### 2. Status and state consistency

- **Confirmed means assigned:** If the UI or API shows an assignment as “confirmed,” there must be a corresponding persisted assignment (e.g. sub_assignment or teacher_schedule or staffing_event). No “confirmed” without a backing record.
- **Staffing state math:** Computed state (understaffed, OK, surplus) must use the same assignment and ratio data that the grid displays. If the grid shows N people in a cell, the staffing logic for that cell must not assume a different N.
- **School scope:** All schedule and assignment data is scoped by `school_id`; no cross-school visibility or mutation.

### 3. Edit panel: commit and cancel

- **Commit (Save):** A single “Save” or “Assign” action must result in a consistent persisted state. If multiple API calls are required, they must be ordered and handled so that a partial failure does not leave the system in an invalid state (e.g. one record updated and another not). After success, the UI must refresh or update so the user sees the new state.
- **Cancel:** Cancel must discard in-memory or in-form edits and close without persisting. No API calls that write data on cancel.
- **No partial writes:** A user action must not trigger a write that updates only part of the intended change (e.g. updating one cell but not the related teacher_schedule) unless that partial update is documented and intentional.

### 4. Conflict handling

- **Detection:** When a user action would create an invalid or conflicting state (e.g. same teacher assigned to two slots, sub double-booked), the system must detect it and surface it (API error or UI conflict banner), not silently overwrite or ignore.
- **Resolution:** Resolution flows (e.g. resolve-conflict, “remove other,” “mark floaters”) must leave data consistent: no orphaned records, no duplicate assignments for the same (teacher/sub, slot, date).

### 5. Rendering rules

- **Cell order (Weekly):** Within each cell, display order is: Absence → Sub (directly below absence, arrow pointing to Sub) → Permanent staff → Flex staff → Floaters. Baseline shows only Permanent, Flex, Floaters (no Absences, Subs, or Temporary Coverage).
- **Legend scope:** Baseline legend shows only Teacher, Flex Teacher, and Floater. Weekly legend may additionally show Substitute, Absent, and Temporary Coverage (overlay items).
- **No duplicate staff in cell:** If a staff member is absent, show them only as an absence—not also as permanent or flex in the same cell. A staff member appears at most once per cell.
- **Active vs inactive:** Active cells have white background; inactive cells have gray background. Inactive can be due to parent (classroom or time slot inactive) or the cell itself being inactive. Inactive filter (when unchecked) hides inactive cells from view.
- **Colors consistent:** Classroom labels and legend colors match Classroom Settings and are used consistently across the grid.

## Scope

- Applies to: Weekly Schedule page and API, Baseline Schedule (schedule cells, teacher schedules), flex assignment APIs, sub assignment APIs, and any code that computes “who is covering” or staffing state for the grid.
- Does not replace: [AUDIT_LOG_CONTRACT.md](./AUDIT_LOG_CONTRACT.md) (audit payload shape). Audit logging for schedule changes must still satisfy that contract.

## References

- [APP_PURPOSE_AND_CONTEXT.md](../APP_PURPOSE_AND_CONTEXT.md) — Core Product Principles (baseline foundational, status reflects reality, avoid silent data changes)
- Scenarios: [04-weekly-schedule-review.md](../../scenarios/gold/04-weekly-schedule-review.md), [05-baseline-schedule-review.md](../../scenarios/gold/05-baseline-schedule-review.md)
