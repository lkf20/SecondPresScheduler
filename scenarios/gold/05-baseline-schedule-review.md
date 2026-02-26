# Gold Scenario: Baseline Schedule — Thorough Review Checklist

**Status:** Scenario doc for AI-led review. Use as checklist for code logic, backend, UI, and UX. Implement as `@gold` Playwright tests where high-value.

## Intent

Define “done right” for the **Baseline Schedule** (configuration and assignments): permanent vs flex clear, no conflict with time-off logic, cells and teacher assignments consistent, save/refresh reliable.

## Review Dimensions

### 1. Data and logic (backend / API)

- [ ] **Schedule cells:** Create/update/delete of schedule cells are scoped by school; uniqueness (e.g. classroom, day, time_slot) is enforced; no silent overwrite of another school’s data.
- [ ] **Teacher schedules (baseline):** Assign/unassign/update permanent or flex teacher to a (classroom, day, time_slot) respects DB uniqueness (one assignment per teacher per slot); conflicts are detected and returned (e.g. conflict endpoint) rather than silent overwrite.
- [ ] **Permanent vs flex:** Backend and API distinguish permanent vs flex assignments where required; flex behaves closer to baseline than to ad-hoc sub (e.g. for staffing calculations and conflict rules).
- [ ] **No conflict with time off:** Baseline operations do not silently invalidate or hide time off; time off creates “gaps” that Sub Finder and weekly view consume; baseline remains the structural source.

### 2. UI — structure and visibility

- [ ] **Baseline view:** User can see and navigate classrooms, days, time slots; schedule cells and teacher assignments display correctly for the selected scope.
- [ ] **Permanent vs flex in UI:** Clear distinction between permanent and flex in labels or presentation so the director is not confused (per APP_PURPOSE_AND_CONTEXT — Baseline Staffing Setup).
- [ ] **Empty and loading states:** No blank or broken view when data is loading or when there are no cells/assignments; clear empty-state copy where appropriate.
- [ ] **Baseline shows only permanent, flex, floaters:** Baseline Schedule does not show Absences or Subs (those are temporary overlays; Weekly shows them).
- [ ] **No duplicate staff in cell:** A staff member appears only once per cell (e.g. not as both permanent and flex in the same cell).
- [ ] **Active vs inactive cells:** Active cells have white background; inactive cells have gray background (parent inactive = classroom or time slot; or cell itself inactive).
- [ ] **Classroom labels:** Classroom labels match the colors assigned in Classroom Settings.
- [ ] **Staffing state per cell:** Each cell correctly displays whether it Meets preferred, is Below preferred, or is Below required.
- [ ] **Legend:** Legend correctly matches colors and styles used in the grid.
- [ ] **Scroll behavior:** Schedule is scrollable horizontally and vertically with left and top headers staying fixed.
- [ ] **Layout matches Weekly:** Layout and structure of Baseline Schedule match Weekly Schedule; the only content difference is Baseline = permanent, flex, floaters only (no absences/subs), and Baseline is not associated with a time period (no week picker).

### 3. Filtering and layout modes (Baseline)

- [ ] **Filters are single select:** Filters show correct count in parentheses; selected filters correctly filter the schedule.
- [ ] **Inactive filter:** When “Inactive” is checked, inactive cells are visible (gray); when unchecked, they are not displayed.
- [ ] **Inactive badges:** Inactive badges display correctly on inactive classrooms and inactive time slots.
- [ ] **Classrooms × Days vs Days × Classrooms:** Same as Weekly—both layout modes show the same information; only axis layout differs. UI and behavior should match.
- [ ] **“Showing X of Y slots”:** Accurate and updates when filters change.
- [ ] **Cells clickable:** Cells are clickable and open the correct right-hand pane.

### 4. Panel behavior (Baseline = edit panel)

- [ ] **Right panel is edit panel:** In Baseline Schedule, the right panel is the **edit** panel (not read-only). User can edit schedule cells and teacher assignments from this panel.

### 5. Editing (panel commit / cancel)

- [ ] **Open panel:** Opening a cell or assignment for edit shows current state; form is populated from the correct source of truth.
- [ ] **Save:** Save persists schedule cells and/or teacher schedules; UI refreshes so the baseline view reflects the new state; no partial or duplicate writes.
- [ ] **Cancel:** Cancel discards edits and closes without persisting; no partial writes or silent state changes.
- [ ] **Bulk operations:** If bulk update exists, it is atomic or clearly documented; no inconsistent partial application.

### 6. Consistency with weekly schedule

- [ ] **Single source of truth:** Changes in baseline are reflected in the weekly schedule and dashboard when those views load; no permanent “stale baseline” where weekly shows different structural data.
- [ ] **Refresh after save:** After saving baseline changes, a subsequent load of weekly (or dashboard) sees the updated baseline; no client-only cache that ignores server state indefinitely.

### 7. UX and errors

- [ ] **Validation:** Invalid input (e.g. missing required field, duplicate assignment) is caught and reported with actionable messages (per APP_PURPOSE_AND_CONTEXT — Error Messaging).
- [ ] **Conflict handling:** If the user’s action would create a baseline conflict (e.g. same teacher double-booked), the system surfaces it and offers resolve options rather than failing silently or corrupting data.
- [ ] **Refresh (if present):** If Baseline Schedule has a refresh control, it fetches the latest data and refreshes the view.

## Out of scope for this scenario

- Weekly Schedule grid and overlays (see 04-weekly-schedule-review.md).
- Sub Finder and time off request creation (covered by other scenarios and flows).
- Audit log shape (see AUDIT_LOG_CONTRACT.md).

## Test coverage

| Area                                                       | Covered by test? | Notes                                                                                                                           |
| ---------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Baseline handoff from Weekly (“Edit baseline assignment?”) | Yes              | weekly-schedule-panel.smoke.spec.js                                                                                             |
| Baseline save refreshes schedule data                      | Yes              | weekly-schedule-panel.smoke.spec.js                                                                                             |
| Rendering (permanent/flex/floaters only, no absences/subs) | No               | **Candidate for @gold or component test**                                                                                       |
| Filtering, layout modes, inactive filter                   | No               | **Candidate for @gold or component test**                                                                                       |
| Right panel = edit panel (Baseline)                        | No               | **Candidate for @gold:** e.g. “Clicking a cell in Baseline opens right-side edit panel (not read-only)”                         |
| Layout parity with Weekly                                  | No               | **Candidate for @gold:** e.g. “Baseline and Weekly share same grid layout; Baseline omits absences/subs and has no week picker” |
| Refresh button (if present)                                | No               | **Candidate for @gold:** e.g. “Refresh triggers refetch and grid updates with latest data”                                      |

## References

- [APP_PURPOSE_AND_CONTEXT.md](../../docs/APP_PURPOSE_AND_CONTEXT.md) — Core Product Principles, Baseline Staffing Setup, Key User Flows
- [SCHEDULE_SEMANTICS_CONTRACT.md](../../docs/contracts/SCHEDULE_SEMANTICS_CONTRACT.md) — invariants for baseline and editing
- Existing smoke: baseline handoff and save refresh in `tests/e2e/weekly-schedule-panel.smoke.spec.js`
