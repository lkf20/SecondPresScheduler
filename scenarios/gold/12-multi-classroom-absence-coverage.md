# Gold Scenario: Multi-classroom absence coverage

**Status:** Partially covered by unit/integration tests; extend with `@gold` E2E when stable test data exists.

## Intent

When a teacher (floater) is scheduled in **two or more classrooms** for the same calendar day and time slot, a single absence must generate **one coverage need per classroom** so directors can assign subs independently, as a floater across both rooms, or leave one room uncovered. Legacy rows with null `classroom_id` on `coverage_request_shifts` must remain resolvable until cleaned up.

## Contract

- **DB:** Inserting `time_off_shifts` creates matching `coverage_request_shifts` per distinct `teacher_schedules.classroom_id` for that teacher/day/slot; `time_off_shift_id` links back where applicable (migration 121).
- **Assign Sub:** User can choose “both rooms (floater)” or one room; assigning one room leaves the other uncovered and may show follow-up copy + Sub Finder link.
- **API safety:** `POST /api/assign-sub/shifts` warns when resolving `coverage_request_shift_id` via `date|slot_code` only (legacy null classroom).
- **Display:** Absence summaries stay person-shift oriented; labels can show “(N rooms: …)” for multi-room slots.

## References

- [AGENTS.md](../../AGENTS.md) — Multi-classroom absence coverage
- [docs/guides/MULTI_CLASSROOM_COVERAGE_DEPENDENCY_AUDIT.md](../../docs/guides/MULTI_CLASSROOM_COVERAGE_DEPENDENCY_AUDIT.md)
- Tests: `lib/utils/__tests__/time-off-card-data.test.ts`, `app/api/assign-sub/shifts/__tests__/route.integration.test.ts`, `components/staff/__tests__/StaffForm.test.tsx`
