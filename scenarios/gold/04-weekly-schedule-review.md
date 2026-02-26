# Gold Scenario: Weekly Schedule — Thorough Review Checklist

**Status:** Scenario doc for AI-led review. Use as checklist for code logic, backend, UI, and UX. Implement as `@gold` Playwright tests where high-value.

## Intent

Define “done right” for the **Weekly Schedule** so an AI (or human) can review thoroughly: baseline + overlays correct, staffing state clear, editing safe, conflict resolution works.

## Review Dimensions

### 1. Data and logic (backend / API)

- [ ] **Baseline + overlays:** Weekly schedule API returns baseline assignments (permanent + flex) plus overlay data (sub assignments, time off) so the client can render “who is actually covering” per cell. No missing or duplicated assignments for a (classroom, day, time_slot).
- [ ] **Status consistency:** Staffing state (understaffed / OK / surplus) is computed from the same data the grid uses; no silent mismatch between badge state and visible assignments.
- [ ] **School scope:** All queries and responses are scoped by `school_id`; no cross-school leakage.

### 2. UI — structure and visibility

- [ ] **Grid structure:** Classrooms (or equivalent grouping), days, and time slots render; assignments (teachers, flex, subs) appear in the correct cells when data is present.
- [ ] **No silent blank grid:** If the API returns valid data, the grid shows it (no permanent loading or empty state due to a front-end bug).
- [ ] **State hierarchy:** Staffing badges/state (e.g. understaffed, OK, surplus) are scannable; above-preferred is visible but not alarming (per APP_PURPOSE_AND_CONTEXT).
- [ ] **Consistency:** Colors and labels mean the same thing everywhere (per design guardrails).
- [ ] **Cell order in Weekly:** Within each cell, display order is: Absence → Sub (directly below absence, with arrow pointing to Sub) → Permanent staff → Flex staff → Floaters.
- [ ] **No duplicate staff in cell:** If a staff member is absent, show them only as an absence—not also as permanent or flex in the same cell.
- [ ] **Active vs inactive cells:** Active cells have white background; inactive cells have gray background. Inactive can be due to parent (classroom or time slot inactive) or the specific cell being inactive.
- [ ] **Classroom labels:** Classroom labels match the colors assigned in Classroom Settings.
- [ ] **Staffing state per cell:** Each cell correctly displays whether it Meets preferred, is Below preferred, or is Below required.
- [ ] **Legend:** Legend correctly matches colors and styles used in the grid.
- [ ] **Scroll behavior:** Schedule is scrollable horizontally and vertically with left and top headers (classrooms, days/time slots) staying fixed.

### 3. Filtering and layout modes

- [ ] **Filters are single select:** Each filter (e.g. Classrooms, Days, Time slots, Subs) is single-select; selected filters show correct count in parentheses (e.g. “Subs (2)”).
- [ ] **Inactive filter:** When “Inactive” is checked, inactive cells are visible (gray background); when unchecked, inactive cells are not displayed.
- [ ] **Inactive badges:** Inactive badges display correctly on inactive classrooms and inactive time slots.
- [ ] **Classrooms × Days vs Days × Classrooms:** Both layout modes display the same information. Classrooms × Days: classrooms on the left, days and time slots across the top. Days × Classrooms: days and time slots on the left, classrooms across the top. UI and behavior should match aside from layout.
- [ ] **“Showing X of Y slots”:** Count is accurate and updates when filters change.
- [ ] **Filter application:** Selected filters correctly filter the schedule (e.g. only selected classrooms, time slots, etc., are shown or counted as intended).
- [ ] **Cells clickable:** Cells are clickable and open the correct right-hand pane.

### 4. Panel behavior (Weekly = read-only detail)

- [ ] **Right panel is read-only:** In Weekly Schedule, the right panel is the read-only detail panel (not the edit panel).
- [ ] **Navigation to edit:** Clicking an action in the read-only panel (e.g. “Edit baseline”) takes the user to the correct place to make edits (e.g. Baseline Schedule edit panel).

### 5. Editing (panel commit / cancel)

- [ ] **Open panel:** Opening a cell or slot shows current state; no partial or stale data in the form.
- [ ] **Save:** Save persists to backend and refreshes the view so the grid reflects the new state; no half-saved or duplicate writes.
- [ ] **Cancel:** Cancel discards edits and closes without persisting; no partial writes or silent state changes.
- [ ] **No partial writes:** A single user action (e.g. “Save”) does not result in multiple inconsistent API calls that leave data in an invalid state.

### 6. Conflict resolution

- [ ] **Conflict detection:** When a change would create a baseline conflict (e.g. same teacher, same slot elsewhere), the UI surfaces it (e.g. ConflictBanner) before or after the user attempts save.
- [ ] **Resolve flow:** User can resolve via the offered options (e.g. remove other, mark floaters); resolve API and UI leave data consistent (no orphaned or duplicate assignments).
- [ ] **No silent overwrite:** Conflicting assignments are not silently overwritten without user choice.

### 7. Flex assignment (weekly context)

- [ ] **Flex in weekly view:** Assigning flex from the weekly schedule (date range, slot) creates the intended staffing event; double-booking is prevented (409 or equivalent).
- [ ] **Visibility:** New flex assignment appears in the grid after save; removal removes it without leaving stale state.

### 8. Week selection, refresh, and data consistency

- [ ] **Default week:** Present week is the default displayed week when opening Weekly Schedule.
- [ ] **Today button:** Clicking “Today” updates the view to the present week.
- [ ] **Refresh button:** Refresh button successfully fetches the latest data and refreshes the page.
- [ ] **Data consistency:** Data in cells is consistent with data elsewhere in the app (e.g. an absence reflects a time off request; a sub reflects a sub assignment; permanent/flex reflect baseline teacher_schedules).

### 9. UX and performance

- [ ] **Load time:** Grid and related data load in a reasonable time; no unnecessary waterfall requests that block render.
- [ ] **Error handling:** Errors (network, validation, 409) are surfaced clearly and are actionable (per APP_PURPOSE_AND_CONTEXT — Error Messaging).
- [ ] **Low cognitive load:** Director can scan and act without training; urgent states are obvious.

## Out of scope for this scenario

- Sub Finder flow (covered by 01-double-booking and absence → coverage flow).
- Baseline Schedule **configuration** (class groups, classrooms, days, time slots) — see 05-baseline-schedule-review.md.
- Audit log shape (see AUDIT_LOG_CONTRACT.md).

## Test coverage

| Area                                                             | Covered by test? | Notes                                                                                                                                      |
| ---------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Load + grid structure (classroom, assignment visible)            | Yes              | `@gold` baseline-weekly-schedule.gold.spec.js; smoke weekly-schedule-panel.smoke.spec.js                                                   |
| Baseline handoff (“Edit baseline assignment?”)                   | Yes              | weekly-schedule-panel.smoke.spec.js                                                                                                        |
| Baseline save refreshes data                                     | Yes              | weekly-schedule-panel.smoke.spec.js (request count after save)                                                                             |
| Flex removal scope                                               | Yes              | weekly-schedule-panel.smoke.spec.js                                                                                                        |
| Rendering rules (cell order, inactive gray, no duplicate staff)  | No               | **Candidate for @gold or unit tests**                                                                                                      |
| Filtering (single select, counts, Inactive filter, layout modes) | No               | **Candidate for @gold or component tests**                                                                                                 |
| Panel behavior (read-only vs edit, navigation to Baseline)       | No               | **Candidate for @gold:** e.g. “Clicking ‘Edit baseline’ in Weekly read-only panel navigates to Baseline Schedule edit panel”               |
| Week default, Today, Refresh                                     | No               | **Candidate for @gold:** e.g. “Refresh button triggers refetch and grid updates with latest data”; “Today button switches to present week” |
| Data consistency (absence = time off, sub = assignment)          | Partially        | Implied by API/data layer; **candidate for integration test**                                                                              |

## References

- [APP_PURPOSE_AND_CONTEXT.md](../../docs/APP_PURPOSE_AND_CONTEXT.md) — Core Product Principles, Weekly Operational Review, UI Philosophy
- [SCHEDULE_SEMANTICS_CONTRACT.md](../../docs/contracts/SCHEDULE_SEMANTICS_CONTRACT.md) — invariants for baseline + overlays and editing
- Existing: [03-baseline-weekly-schedule-correctness.md](./03-baseline-weekly-schedule-correctness.md) (load + structure)
