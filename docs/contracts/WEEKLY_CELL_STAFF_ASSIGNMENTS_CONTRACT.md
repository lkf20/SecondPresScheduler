# Weekly Cell Staff Assignments Contract

This contract defines ideal-state behavior for the **Staff Assignments** section of the **Weekly Schedule cell editor**. It enforces strict separation between:

- **Weekly-only (date-specific) operations**
- **Baseline/shared template operations**

If implementation diverges, this contract is the source of truth for fixes and tests.

## 1) Feature Goal and User Intent

- Directors/admins need to make reliable, date-specific staffing decisions inside Weekly Schedule without accidentally changing baseline templates.
- Directors/admins also need clear visibility into baseline staffing context for each weekly cell.
- The UI must make ownership obvious: weekly actions change only date-level operational data; baseline edits happen only in baseline flows.

## 2) Scope and Non-goals

### In scope

- Weekly cell editor behavior for staff assignments, absences, subs, and temporary coverage.
- Weekly panel display and action rules for staff assignment data.
- Domain boundaries between weekly and baseline actions.
- API and data invariants needed to preserve boundary and integrity.

### Out of scope

- Baseline schedule authoring semantics outside explicit handoff rules.
- Broader Sub Finder recommendation logic (except integration points used by weekly panel actions).
- Weekly notes behavior (covered in `WEEKLY_SCHEDULE_CELL_NOTES_CONTRACT.md`).

## 3) Weekly vs Baseline Boundary

### Boundary Table

| Behavior                                                             | Owner Domain   | Weekly Panel Allowed?                   | Baseline Editor Allowed? | Notes                                                               |
| -------------------------------------------------------------------- | -------------- | --------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| Add/remove assigned baseline staff (`teacher_schedules`)             | Baseline       | No direct write                         | Yes                      | Weekly may only hand off.                                           |
| Set/unset floater on baseline staff (`teacher_schedules.is_floater`) | Baseline       | No direct write                         | Yes                      | Weekly may display floater badges.                                  |
| Show absences (`time_off_requests`, `time_off_shifts`)               | Weekly         | Yes (read + navigate/edit time off)     | Read-only context only   | Date-specific operational state.                                    |
| Add/edit/cancel time off                                             | Weekly         | Yes via time-off flow                   | No direct write          | Weekly actions never mutate baseline template.                      |
| Show sub assignments (`sub_assignments`)                             | Weekly         | Yes                                     | Read-only context only   | Includes sub/non-sub override metadata.                             |
| Change/remove sub assignment                                         | Weekly         | Yes via sub-finder/unassign API         | No                       | One active sub per coverage shift invariant applies.                |
| Show temporary coverage (`staffing_events`, `staffing_event_shifts`) | Weekly         | Yes                                     | Read-only context only   | Date-specific staffing overlay.                                     |
| Add/edit/remove temporary coverage                                   | Weekly         | Yes                                     | No                       | Must respect closure rules and unique constraints.                  |
| Conflict checks for baseline teacher schedule changes                | Baseline       | Not applicable in read-only weekly mode | Yes                      | Weekly panel may open baseline edit flow that owns this logic.      |
| Save/apply semantics for template staff                              | Baseline       | No direct save in weekly mode           | Yes                      | Multi-day apply belongs to baseline edit mode.                      |
| Navigation handoff to baseline staff editing                         | Shared handoff | Yes (handoff only)                      | Yes                      | Weekly preserves cell context and switches domain explicitly.       |
| Audit category/entity for baseline staff write                       | Baseline       | N/A                                     | Required                 | `category=baseline_schedule`, `entityType=teacher_schedule`.        |
| Audit category/entity for temporary coverage write                   | Weekly         | Required                                | N/A                      | `category=temporary_coverage`, `entityType=staffing_event`.         |
| Audit category/entity for sub/time-off write                         | Weekly         | Required                                | N/A                      | Must use weekly operational categories/entities per audit contract. |

### Do Not Cross Boundaries Rules

1. Weekly read-only cell mode MUST NOT mutate `teacher_schedules` directly.
2. Baseline editor MUST NOT create/update/cancel `sub_assignments`, `time_off_requests`, `time_off_shifts`, `staffing_events`, or `staffing_event_shifts`.
3. Weekly panel MAY show baseline staff assignments as context and MAY provide explicit handoff to baseline editor.
4. Baseline-origin changes MUST be audited as baseline schedule events; weekly operational changes MUST use operational categories.
5. Any API invoked from weekly mode must be date-scoped and school-scoped; template-scoped writes require explicit baseline mode.

## 4) Canonical Terms and Entities

- **Weekly cell:** A date-qualified operational slot (`date + classroom_id + time_slot_id`) shown in Weekly Schedule.
- **Baseline cell:** Template slot (`day_of_week_id + classroom_id + time_slot_id`) stored in `schedule_cells` and `teacher_schedules`.
- **Baseline assignment:** A `teacher_schedules` row for a teacher in a baseline cell.
- **Absence:** Active `time_off_request` and its `time_off_shifts` for a teacher/date/slot.
- **Sub assignment:** Active `sub_assignments` row tied to a coverage shift; may include `is_floater` and `non_sub_override`.
- **Temporary coverage:** Active `staffing_events` + `staffing_event_shifts` rows (date-specific overlay).
- **Floater:** Staff/sub assignment contributing partial coverage weight (0.5 in coverage calculations) per coverage contract.
- **Conflict (baseline):** Same teacher scheduled in another classroom for same day/slot where both assignments are not both floater.
- **Soft conflict (operational):** Availability/qualification warnings where override is allowed.
- **Hard conflict (operational):** Double-booking conflicts (`conflict_teaching`, `conflict_sub`) where assignment is blocked.

## 5) Explicit Functional Requirements

1. Weekly cell editor in read-only weekly mode must render staff assignments in this order:
   - Absent teacher blocks
   - Their sub assignments
   - Permanent baseline assignments
   - Flex baseline assignments
   - Temporary coverage assignments
   - Floater assignments
2. A staff member must appear at most once in Weekly Staff Assignments for a cell/date.
3. If a staff member is both absent and assigned in that same cell/date, **absence has priority**:
   - show the staff member only in the Absent group
   - exclude them from permanent/flex/temporary/floater/sub display groups for that cell/date
4. Weekly mode must support date-specific actions:
   - Add/edit time off
   - Find sub / change sub
   - Remove sub assignment (scope: single/all-for-absence where supported)
   - Add/edit/remove temporary coverage
5. Weekly mode must expose baseline staffing as contextual, with a single explicit handoff action to edit baseline staff.
6. Weekly mode must disable assignment-changing controls for closed or inactive cells/slots and label non-assignable reasons.
7. Baseline editing mode must own:
   - Teacher chips selection/removal
   - Floater toggling
   - Conflict detection and resolution
   - Apply-scope save semantics
8. Save in baseline mode must preserve in-place update semantics when editing existing rows and avoid delete+create unless required by logical identity change.

## 6) Implied Requirements

1. Every operation must be scoped by authenticated user school context; cross-school reads/writes must return 403/404.
2. Authorization and validation must be server-enforced even if client validates first.
3. UI controls must be keyboard operable and screen-reader labeled.
4. Stale view state after write must refresh deterministically (invalidate relevant caches/queries).
5. Error messages must be actionable and context-specific (teacher/date/classroom/slot when possible).

## 7) State Model

### Valid States

1. Weekly cell, no absences, baseline staff only.
2. Weekly cell with absences and no sub (needs coverage).
3. Weekly cell with absences and active sub assignment(s).
4. Weekly cell with temporary coverage overlay present.
5. Weekly cell with baseline floater assignment(s) and/or floater sub assignment(s).
6. Baseline edit mode with unresolved conflicts shown in conflict banner.
7. Baseline edit mode with conflict resolutions selected and applied.

### Invalid or Contradictory States

1. Weekly read-only mode issuing direct `teacher_schedules` writes.
2. Closed cell showing assignable controls as enabled.
3. More than one active sub for the same coverage request shift.
4. Non-floater sub double-booked in same date/time slot across multiple rooms.
5. Baseline and weekly writes applied in a single ambiguous save action.
6. Same staff rendered in both absence and assignment groups for one cell/date.

### Transitions

1. Weekly read-only -> baseline edit: explicit handoff action; baseline save controls appear only after transition.
2. Baseline edit -> weekly read-only: cancel/close or post-save refresh preserving selected cell context.
3. Weekly absence without sub -> find sub flow -> assignment created -> weekly panel refreshes and shows sub row.
4. Weekly temporary coverage add/edit/remove -> API success -> weekly panel refreshes and recalculates staffing warning state.
5. Conflict detected -> resolution chosen (`remove_other`/`cancel`/`mark_floater`) -> apply -> teacher chips and conflict list refresh.

### Lock and Auto-set Dependencies

1. If cell is school-closed, assignment-mutating actions are locked.
2. If cell/slot is inactive, assignment-mutating actions are locked and explanatory copy shown.
3. If resolution is `mark_floater`, resulting target and conflicting baseline assignments for that teacher/day/slot must set `is_floater=true`.
4. If temporary coverage remove leaves no active shifts in event, parent `staffing_events.status` must auto-set to `cancelled`.

### Precedence Rules

1. School closure lock has highest precedence over all assignment actions.
2. Hard conflict blocks assignment even if user attempts override.
3. Weekly overlays (absence/sub/temp coverage) affect operational rendering but never rewrite baseline template rows.

## 8) UX Rules (Weekly Staff Assignments)

1. Staff Assignments card must group by source type with clear labels/chips.
2. Weekly action buttons must be contextual:
   - No sub on absence: show `Find Sub`
   - Sub exists: show `Change Sub` and remove action
   - Baseline assignment rows: show `Find Sub` and `Add Time Off` shortcuts
3. Baseline handoff action should be low-emphasis secondary action (`Edit baseline staff`) and never primary CTA in weekly mode.
4. Conflict UI appears only in baseline edit mode and must include explicit resolution choices plus apply action.
5. Loading, empty, and error states:
   - Loading indicators for data-fetching actions.
   - Empty copy: `No staff assigned for this slot.`
   - Errors use inline/structured feedback or toast; avoid browser `alert` in final UX.
6. Accessibility:
   - Interactive chips/actions must have labels.
   - Conflict options must be keyboard-selectable radio controls.
   - Focus management after save/remove/change should keep users in predictable context.

## 9) API Contract

### Weekly Read Surface

- `GET /api/weekly-schedule`
  - Returns weekly classroom/day/slot cells with:
    - baseline-derived assignments
    - absences
    - sub assignments
    - temporary coverage shifts
    - closure metadata
  - Status:
    - `200` success
    - `403` missing/invalid school context
    - `500` unexpected failure

### Weekly Operational Writes

- Time off:
  - `POST /api/time-off`
  - Validates teacher, range, overlap rules, and closure filtering.
  - Returns `409` on overlap conflict; `400` on invalid payload; `403` school context missing.
- Sub assignment retrieval for panel flows:
  - `POST /api/assign-sub/shifts`
  - Returns date-scoped shift rows including `school_closure` and assignment metadata.
- Sub unassign:
  - `POST /api/sub-finder/unassign-shifts`
  - Requires absence+sub context and scope.
- Temporary coverage:
  - `POST /api/staffing-events/flex` create/update-style add
  - `GET/POST /api/staffing-events/flex/remove` inspect/remove by scope
  - `POST /api/staffing-events/flex/availability` availability checks
  - `409` for unique booking conflicts; `400` invalid scope/payload; `403` school context missing.

### Baseline Writes (from baseline edit mode only)

- `GET /api/teacher-schedules`
- `POST /api/teacher-schedules`
- `PUT /api/teacher-schedules/[id]`
- `DELETE /api/teacher-schedules/[id]`
- `POST /api/teacher-schedules/check-conflicts`
- `POST /api/teacher-schedules/resolve-conflict`

Rules:

1. School scoping is mandatory.
2. Validation errors return `400`.
3. Teacher schedule hard conflicts return `409`.
4. Conflict resolution endpoint must be idempotent per resulting state (repeat apply should not create duplicates).
5. Client retries must not violate uniqueness constraints or create duplicate active rows.

## 10) Data/DB Invariants

1. Baseline uniqueness:
   - `teacher_schedules` uniqueness includes `(teacher_id, day_of_week_id, time_slot_id, classroom_id)`.
2. Sub assignment integrity:
   - One active sub per `coverage_request_shift_id`.
   - One active non-floater sub per `(sub_id, date, time_slot_id)`.
3. Temporary coverage integrity:
   - One active flex shift per `(school_id, staff_id, date, time_slot_id)` in `staffing_event_shifts`.
4. School scope integrity:
   - All weekly/baseline assignment rows are school-bound and must enforce FK + policy constraints.
5. In-place updates preferred for edits to preserve IDs, audit trails, and FK references.

## 11) Concurrency / Race Conditions

1. Simultaneous weekly edits on same cell/date:
   - Last-write-wins may occur; UI must refresh on completion and preserve selected cell context.
2. Concurrent baseline conflict resolutions:
   - Server must re-check conflicts during apply, not trust stale client snapshot.
3. Stale refresh races:
   - Any optimistic UI state must reconcile with authoritative re-fetch after mutation.
4. Duplicate submit protection:
   - Mutating buttons should disable while pending to reduce duplicate requests.

## 12) Audit Logging Requirements

1. Baseline staff schedule writes:
   - `category=baseline_schedule`, `entityType=teacher_schedule`
   - Include teacher, classroom, day, slot, floater before/after details.
2. Temporary coverage writes:
   - `category=temporary_coverage`, `entityType=staffing_event`
   - Include staff, classroom scope, date range, shift counts, removal scope.
3. Weekly sub/time-off writes:
   - Must log actor, school scope, and context-rich details per audit contract.
4. All audit writes must pass `AUDIT_LOG_CONTRACT.md` validations.

## 13) Test Contract

### Unit Tests

1. Assignment grouping/sorting in weekly card by source type.
2. Assignment display de-duplication with absence priority.
3. Floater labeling and weighting helpers.
4. Conflict banner option selection and apply enable/disable.
5. Disabled-state logic for closed/inactive cells.

### Integration Tests (API)

1. `POST /api/teacher-schedules/check-conflicts`:
   - both-floater no-conflict behavior
   - role label derivation
2. `POST /api/teacher-schedules/resolve-conflict`:
   - `remove_other`, `cancel`, `mark_floater`
   - no duplicate target rows
3. `POST /api/staffing-events/flex`:
   - closure filtering
   - unique conflict `409`
4. `POST /api/assign-sub/shifts`:
   - `school_closure` flag behavior
   - mapping of assigned sub metadata
5. `GET /api/weekly-schedule`:
   - absences and assignments coherence
   - closure passthrough and school scoping

### E2E / Gold Scenarios

1. Weekly cell with absence -> assign sub -> panel reflects sub in same slot/date.
2. Weekly cell with baseline staff -> handoff to baseline edit -> update floater -> weekly reflects new baseline context.
3. Weekly temporary coverage add -> edit -> remove (single scope and all scopes).
4. Closed day cell shows context but no assignable weekly actions.
5. Boundary regression: weekly read-only mode cannot directly persist baseline teacher schedule mutation.
6. Duplicate-render regression: absent floater/assigned staff appears once and only under absence.

### Regression Tests for Inferred Rules

1. Browser-close prompt should not appear in pure read-only weekly mode after save/no-change states.
2. Baseline edit save failure should not partially apply teacher-schedule writes without surfaced error.
3. School scoping enforced on every write route used by weekly staff assignment flows.

## 14) Implementation Gaps vs Ideal

### Resolved in current implementation

1. **Absence-priority de-duplication in Weekly Staff Assignments**
   - Status: Implemented.
   - Outcome: staff appears once per weekly cell/date; absence suppresses duplicate assignment rendering.
   - Evidence: helper + UI tests added for absent/floater duplicate case.

2. **Error UX in side panel save/conflict flows**
   - Status: Implemented.
   - Outcome: browser `alert(...)` replaced with structured toast/dialog-friendly errors in this flow.
   - Evidence: test coverage verifies toast path and no alert usage for save failure.

3. **Boundary hardening for weekly read-only mode**
   - Status: Implemented (guard added) with regression test.
   - Outcome: baseline save writes are blocked in weekly read-only mode unless user explicitly enters baseline edit mode.

### Remaining High

1. **Baseline save path performs many client-orchestrated calls without explicit transaction contract.**
   - Risk: partial-update behavior under intermittent failures.
   - Remediation: define and implement server-side transactional/batch endpoint for baseline staffing updates.

### Remaining Medium

1. **Conflict resolution and list refresh race handling relies on component-level timing guards.**
   - Risk: stale chip/floater state in edge races.
   - Remediation: consolidate post-apply refresh contract with authoritative reload and deterministic state reducer.
2. **Mixed action density in weekly card can blur ownership boundary.**
   - Risk: user confusion between operational and template edits.
   - Remediation: visually separate weekly actions from baseline handoff region and reinforce labels.

### Low

1. **Inconsistent terminology across UI labels (`flex`, `temporary`, `coverage`)**
   - Risk: minor cognitive load.
   - Remediation: unify label strings and helper copy.

## 15) Open Decisions

1. **Should baseline handoff open inline baseline edit mode or a separate dedicated baseline panel/page?**
   - Recommendation: keep inline handoff for speed, but add stronger visual mode banner: `Editing Baseline Template`.
2. **Should weekly card expose both `Find Sub` and `Add Time Off` on every eligible staff row?**
   - Recommendation: keep both, but collapse into overflow menu on dense cells to reduce visual noise.
3. **Should baseline save become atomic server batch before broader scale-up?**
   - Recommendation: yes, prioritize after current feature stabilization.

## References

- `docs/domain/app-purpose-and-context.md`
- `docs/domain/data-lifecycle.md`
- `docs/contracts/SCHEDULE_SEMANTICS_CONTRACT.md`
- `docs/contracts/AUDIT_LOG_CONTRACT.md`
- `docs/contracts/ASSIGN_SUB_CONFLICT_RESOLUTION_CONTRACT.md`
- `docs/contracts/WEEKLY_SCHEDULE_CELL_NOTES_CONTRACT.md`

## Implementation Changelog

### 2026-03-16

Implemented contract-aligned updates for Weekly cell staff assignments:

1. Added absence-priority de-duplication:
   - staff appears once per weekly cell/date
   - if both absent and assigned, renders only under `Absent`
2. Hardened weekly-vs-baseline boundary in save flow:
   - baseline save writes blocked in weekly read-only mode unless explicitly in baseline edit mode
3. Replaced browser `alert(...)` paths in this flow with structured toast/dialog-friendly error handling.
4. Added regression coverage for:
   - absent+floater duplicate rendering
   - explicit baseline handoff before Save controls appear
   - save-failure toast path (no browser alert)
