# Gold Scenario: Time Off — Overlap Detection and Resolution

**Status:** Checklist for AI-led or human review. Implement as `@gold` tests when high-value.

## Intent

A teacher must not have multiple overlapping time off requests (draft or active). Overlap is defined as: same teacher, and at least one same day with at least one same time slot. When a user tries to create or save a time off request that would overlap an existing draft or active request, the system detects the overlap and guides them to resolve it via a resolution modal.

## Expected Behavior

### 1. Overlap definition

- [ ] **Overlap** = same teacher + one or more same calendar date + one or more same time slot (date + time_slot_id) as another request.
- [ ] Only **draft** and **active** time off requests are considered; cancelled requests do not cause overlap.

### 2. API

- [ ] **POST /api/time-off** and **PUT /api/time-off/:id** run overlap detection (e.g. `findOverlappingTimeOffRequest`) before creating or updating. For PUT, the request being edited is excluded from the check.
- [ ] When overlap is found, the API returns **409 Conflict** (does not create/update) with a JSON body: `code: 'TIME_OFF_OVERLAP'`, plus at least `existingRequestId`, `existingStartDate`, `existingEndDate`, `existingStatus` (`'draft' | 'active'`), `teacherName`, `newRequestStartDate`, `newRequestEndDate`, and overlap date range fields (e.g. `overlapStartDate`, `overlapEndDate`) for the modal message.

### 3. Resolution modal (client)

- [ ] When the form receives 409 with `code === 'TIME_OFF_OVERLAP'`, it shows a modal (does not show a generic error toast).
- [ ] Modal explains the conflict: e.g. "{Teacher} already has [a draft] time off request: {existing range}. Your new request overlaps on {overlap range}. How would you like to proceed?"
- [ ] If the existing request is a **draft**, the copy uses "draft time off request" (or equivalent) so the user knows they are overlapping a draft.
- [ ] Modal offers: **Edit existing request** (navigates to `/time-off?edit=<existingRequestId>`) and **Cancel new request** (closes modal; user stays on form).

### 4. Instructions and tests

- [ ] Overlap rule and 409 behavior are documented (e.g. in `docs/domain/data-lifecycle.md` or a contract).
- [ ] Tests cover: overlap detection returns 409 for POST/PUT when shifts overlap another draft/active request; client shows overlap modal on 409 and "Edit existing request" navigates correctly.

## References

- [data-lifecycle.md](../../docs/domain/data-lifecycle.md) — Time off overlap rule
- [lib/api/time-off.ts](../../lib/api/time-off.ts) — `findOverlappingTimeOffRequest`
- [app/api/time-off/route.ts](../../app/api/time-off/route.ts) — POST overlap check
- [app/api/time-off/[id]/route.ts](../../app/api/time-off/[id]/route.ts) — PUT overlap check
- [components/time-off/TimeOffForm.tsx](../../components/time-off/TimeOffForm.tsx) — 409 handling and resolution modal
