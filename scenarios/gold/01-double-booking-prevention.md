# Gold Scenario: Double-Booking Prevention

**Status:** Implemented as `@gold` Playwright test.

## Intent

The system must prevent double-booking a sub for the same shift(s). When the user attempts to assign a sub who already has an active assignment for one or more of the selected shifts, the API returns **409** with a clear message, and the UI shows that error so the user can correct the selection.

## Contract

- **API:** `POST /api/sub-finder/assign-shifts` must return **409** when the selected sub already has an active assignment for any of the selected (date, time_slot) pairs. Response body must include an actionable error message (e.g. “Double booking prevented: this sub already has an active assignment for one or more selected shifts.”).
- **UI:** When the assign request returns 409, the UI must surface the error (toast, inline message, or alert) so the user is not left with a silent failure.

## Out of scope

- Baseline teacher-schedule double-booking (DB unique constraint + ConflictBanner) is covered separately.
- Flex assignment conflict (409) is a related but separate flow.

## References

- API: `app/api/sub-finder/assign-shifts/route.ts` (sub collision check, 409 response)
- [APP_PURPOSE_AND_CONTEXT.md](../../docs/APP_PURPOSE_AND_CONTEXT.md) — Absence → Coverage flow: “No double booking”
