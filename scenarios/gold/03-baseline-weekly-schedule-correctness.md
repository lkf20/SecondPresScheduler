# Gold Scenario: Baseline → Weekly Schedule Correctness

**Status:** Implemented as `@gold` Playwright test.

## Intent

The weekly schedule view must reflect the **baseline** (permanent + flex staff) plus **overlays** (sub assignments, time off). Data must load and display so that assignments, classrooms, and time slots are visible and structurally correct. This scenario guards against regressions that break the weekly grid or the baseline-first model.

## Contract

- **Load:** Weekly schedule API and schedule settings return data; the page loads without fatal errors.
- **Structure:** The UI shows classrooms (or equivalent grouping), days, and time slots. Assignments (teachers, flex, subs) are present where the API includes them.
- **No silent blank grid:** If the API returns valid data, the grid should show it (not a permanent loading or empty state due to a front-end bug).

## Scope

- Dashboard/weekly schedule page: load and render of the schedule grid with mocked or real API data.
- Does not (in this scenario) assert exact staffing ratios or badge colors; those can be separate tests.

## References

- [APP_PURPOSE_AND_CONTEXT.md](../../docs/APP_PURPOSE_AND_CONTEXT.md) — Core Product Principles (baseline foundational), Key User Flows (Weekly Operational Review, Baseline Staffing Setup)
- Existing smoke: `tests/e2e/weekly-schedule-panel.smoke.spec.js`
