# Gold Scenario: Time Off List — Draft Badge and Request Status

**Status:** Checklist for AI-led or human review. Implement as `@gold` tests when high-value.

## Intent

The Time Off list must correctly show draft vs active requests and display a Draft badge on draft requests so directors can tell them apart. The API and transform must expose request lifecycle status (`request_status`) separately from coverage status.

## Expected Behavior

### 1. API and data shape

- [ ] **GET /api/time-off-requests** returns each item with **`request_status`**: `'draft' | 'active' | 'cancelled'`. This is the time-off-request lifecycle status from the DB.
- [ ] **`status`** in the same response is **coverage status** (`'covered' | 'partially_covered' | 'needs_coverage'`) for display/filtering, not draft vs active.
- [ ] **transformTimeOffCardData** accepts optional **`request_status`** on the request input and includes it in the returned `TimeOffCardData`; it defaults to `'active'` when missing.
- [ ] **app/api/time-off-requests/route.ts** passes **`request_status: request.status`** (from the DB row) when calling `transformTimeOffCardData`.

### 2. Time Off list client

- [ ] **Row status** (draft vs active for tabs and actions) is derived from **`item.request_status`**: `item.request_status === 'draft' ? 'draft' : 'active'`, not from `item.status`.
- [ ] **Draft requests** show in the Drafts tab and in All; they show Edit and Delete (not Find Sub) and display the **Draft badge**.
- [ ] **Draft badge** appears on the card for every draft request: to the right of the teacher name, or to the right of the reason chip (e.g. "Vacation") when present. Badge label: "Draft"; styled for visibility (e.g. amber); `aria-label="Draft"` for accessibility.

### 3. Save as draft (weekly schedule → Time Off)

- [ ] From Weekly Schedule, adding time off and choosing **Save as draft** creates a time-off request with **status `draft`** in the DB and redirects to Time Off. The new request appears under **Drafts** with the Draft badge (not as an active request).

### 4. Dashboard — Upcoming Time Off & Coverage

- [ ] **Only active time off** appears in the Dashboard section "Upcoming Time Off & Coverage". Draft time off requests are excluded. The dashboard overview API filters out coverage requests whose source `time_off_request` has `status = 'draft'`.

## References

- [AUDIT_LOG_CONTRACT.md](../../docs/contracts/AUDIT_LOG_CONTRACT.md) — Time off in scope
- [lib/utils/time-off-card-data.ts](../../lib/utils/time-off-card-data.ts) — TimeOffCardData.request_status, transform default
- [app/(dashboard)/time-off/TimeOffListClient.tsx](<../../app/(dashboard)/time-off/TimeOffListClient.tsx>) — List uses request_status; draft cards pass isDraft to TimeOffCard
- [components/shared/TimeOffCard.tsx](../../components/shared/TimeOffCard.tsx) — isDraft prop, Draft badge placement
- [app/api/dashboard/overview/route.ts](../../app/api/dashboard/overview/route.ts) — excludes draft time off from coverage_requests
- [lib/dashboard/filter-draft-time-off.ts](../../lib/dashboard/filter-draft-time-off.ts) — filterCoverageRequestsToActiveTimeOffOnly
