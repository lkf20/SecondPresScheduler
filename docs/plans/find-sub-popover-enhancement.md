# Find Sub Popover Enhancement – Implementation Plan

This plan implements the enhanced Find Sub flow: after selecting a teacher, the popover shows whether they have upcoming time off and lets the user choose existing absence vs. new dates before navigating to Sub Finder.

---

## Overview

**Current flow:** Find Sub → select teacher → Go → Sub Finder (Existing Absences). If teacher has no time off, user sees "No absences found" and must switch to Manual Coverage and re-enter teacher + dates.

**New flow:** Find Sub → select teacher → (fetch time off) → show status + options → user selects intent (existing absence or new dates: Today / Tomorrow / Custom) → Go → Sub Finder with teacher and dates prefilled.

---

## Definitions

- **Upcoming time off:** Time-off requests where `end_date >= today` (or `start_date >= today` if `end_date` is null). Excludes past-only absences. Use `status=active` only.
- **Labels:**
  - "Find sub for different dates" (not "New time off") when teacher has existing absences, to avoid implying we're creating time off in this flow
  - "Find sub for:" with sub-options: Today, Tomorrow, Custom date range
  - Existing absences: "Mon, Apr 4 – Tue, Apr 5" (range) or "Mon, May 4" (single day) using `formatAbsenceDateRange`

---

## Phase 1: API for Teacher Upcoming Time Off

**Goal:** Fetch upcoming time off for a selected teacher when the popover needs it.

### 1.1 Reuse existing API

Use `/api/time-off-requests` with:

- `teacher_id` = selected teacher
- `start_date` = today (ISO)
- `end_date` = far future (e.g. 1 year ahead) or omit to get all overlapping
- `status` = `active` (default)

**Implementation:**

- [ ] Create a small client-side fetch helper or use `fetch` in the Header component.
- [ ] Call `GET /api/time-off-requests?teacher_id=${id}&start_date=${todayISO}&status=active` when a teacher is selected.
- [ ] Parse response: if array is empty → "has no upcoming time off"; otherwise → "has existing upcoming time off" and use the list for options.
- [ ] **Upcoming filter:** Keep only requests where `end_date >= today` (or `start_date >= today` if `end_date` is null). The API may return overlapping requests; client can filter: `item.end_date >= today || item.start_date >= today`.
- [ ] Response shape: `TimeOffCardData[]` with `id`, `teacher_id`, `teacher_name`, `start_date`, `end_date`, `reason`, etc. (see `lib/utils/time-off-card-data.ts`).

### 1.2 (Optional) Lighter endpoint

If `/api/time-off-requests` is heavy, add a minimal endpoint:

- [ ] `GET /api/teachers/[id]/upcoming-time-off` returning `{ absences: Array<{ id, start_date, end_date, ... }> }`.
- [ ] Defer to Phase 2 if performance is acceptable with the existing API.

---

## Phase 2: Find Sub Popover UI (Header)

**File:** `components/layout/Header.tsx`

**Current:** Teacher search/select → Go (single step).

**New:** Teacher search/select → status message → options (radios) → Go.

### 2.1 State and data fetching

- [ ] Add state:
  - `upcomingTimeOff: TimeOffCardData[] | null` (null = not fetched, [] = none, [...]= has absences)
  - `timeOffLoading: boolean`
  - `findSubDateChoice: 'today' | 'tomorrow' | 'custom' | 'existing'`
  - `findSubExistingAbsenceId: string | null` (when `findSubDateChoice === 'existing'`)
  - `findSubCustomStart: string` (YYYY-MM-DD)
  - `findSubCustomEnd: string` (YYYY-MM-DD)
- [ ] When `selectedTeacherId` is set and not yet fetched for this teacher, call the time-off API. Set `timeOffLoading=true` before fetch, `false` after.
- [ ] On success: set `upcomingTimeOff` (filter for upcoming as above). Reset `findSubDateChoice`, `findSubExistingAbsenceId`, `findSubCustomStart`, `findSubCustomEnd` when teacher changes.
- [ ] When popover closes or teacher changes: clear `upcomingTimeOff` and `timeOffLoading` so next open fetches fresh.

### 2.2 Date helpers

- [ ] Add `getTodayISO()` and `getTomorrowISO()` (or use existing `formatISODate(new Date())` and increment by one day). Ensure local date handling to avoid timezone shifts (see `lib/utils/date.ts`).

### 2.3 Popover layout (after teacher selected)

Structure:

```
[Teacher search – same as current]

--- (when teacher selected and fetch complete) ---

"[Teacher name] has no upcoming time off"
  OR
"[Teacher name] has existing upcoming time off"

Find sub for:
  ○ Today                    (if no absences, or "different dates" branch)
  ○ Tomorrow
  ○ Custom date range
  [Start date picker]        (only when Custom selected)
  [End date picker]          (only when Custom selected, default = start)

  -- OR (only when has existing absences) --
  ○ [Absence 1: Mon, Apr 4 – Tue, Apr 5]
  ○ [Absence 2: Mon, May 4]
  ○ Different dates: Today / Tomorrow / Custom

[Go]
```

- [ ] Use `RadioGroup` (or semantic radio buttons) for mutually exclusive options.
- [ ] When "Custom" is selected, show `DatePickerInput` for Start and End. Default End = Start. Use same component as in TimeOffForm and Manual Coverage.
- [ ] When teacher has existing absences:
  - One radio per absence (use `formatAbsenceDateRange` from `lib/utils/date-format.ts`).
  - One "Different dates" option that reveals Today / Tomorrow / Custom (nested radios or sub-section).
- [ ] If 3+ absences: consider collapsible "Show all X absences" or scrollable list so popover doesn't grow too tall.
- [ ] **Popover width:** Current `w-80` may be tight; consider `w-96` or `min-w-80 max-w-md` if needed. Test with Custom date pickers open.

### 2.4 Loading and error states

- [ ] While `timeOffLoading`: show "Checking time off…" (spinner or skeleton) below teacher name. Disable Go.
- [ ] On fetch error: show "Couldn't load time off. You can still find subs for today." with Today/Tomorrow/Custom as fallback. Allow Go with default "today".
- [ ] Retry: optional "Try again" link that refetches.

### 2.5 Go button logic

- [ ] Disable Go when:
  - No teacher selected, OR
  - Loading, OR
  - Custom selected but start date empty
- [ ] Compute `startDate` and `endDate`:
  - Today: `getTodayISO()`
  - Tomorrow: `getTomorrowISO()`
  - Custom: `findSubCustomStart`, `findSubCustomEnd` (default end = start if empty)
  - Existing: do not pass dates; pass `absence_id` only
- [ ] On Go:
  - If `findSubDateChoice === 'existing'` and `findSubExistingAbsenceId`:
    - `router.push(\`/sub-finder?absence_id=${findSubExistingAbsenceId}\`)`
  - Else (Manual with dates):
    - `router.push(\`/sub-finder?mode=manual&teacher_id=${selectedTeacherId}&start_date=${startDate}&end_date=${endDate}\`)`
  - Close popover and reset state.

---

## Phase 3: Sub Finder URL Params and Prefill

**File:** `app/(dashboard)/sub-finder/page.tsx`

**Goal:** Support `mode=manual`, `teacher_id`, `start_date`, `end_date` in the URL and prefill Manual Coverage.

### 3.1 Read new URL params

- [ ] Read `searchParams.get('mode')`, `searchParams.get('start_date')`, `searchParams.get('end_date')`.
- [ ] Existing: `absence_id`, `teacher_id`, `sub_id` already read.

### 3.2 Apply params on mount (before state restoration)

- [ ] When `mode === 'manual'` and `teacher_id` and `start_date` are present:
  - Set `mode` to `'manual'`.
  - Set `manualTeacherId` = `teacher_id`.
  - Set `manualTeacherSearch` = display name (fetch from teachers list or derive from `getDisplayName(teachers.find(t => t.id === teacher_id))`).
  - Set `manualStartDate` = `start_date`.
  - Set `manualEndDate` = `end_date` or `start_date` if `end_date` is empty.
- [ ] Ensure this runs before or overrides `loadSubFinderState()` when URL params are present. Existing logic: "if requestedAbsenceId || requestedTeacherId, skip restoration." Extend to: "if any of absence_id, teacher_id+mode=manual, etc., apply URL params and skip restoration."
- [ ] Clear these params from the URL after applying (e.g. `router.replace` with cleaned params) to avoid stale state on refresh.

### 3.3 Shift prefill and auto-run

- [ ] `ShiftSelectionTable` already has `autoSelectScheduled={true}` in Manual mode. With `manualTeacherId`, `manualStartDate`, `manualEndDate` set, it will fetch scheduled shifts and auto-select them via `onManualShiftsChange`.
- [ ] After form is prefilled, optionally auto-run `runManualFinder()` (or `runManualFinderAndCollapse`) so the user sees recommended subs immediately. Consider:
  - Auto-run only when `manualSelectedShifts.length > 0` (shifts may load asynchronously). Use a `useEffect` that watches `manualTeacherId`, `manualStartDate`, `manualEndDate`, `manualSelectedShifts` and runs finder once when all are set and we arrived via URL params.
  - Alternative: don't auto-run; let the user click "Find Subs". Simpler but one extra click.
  - **Recommendation:** Auto-run when arriving from Find Sub popover (detect via URL params) to minimize clicks. Add a guard to avoid double-running (e.g. `hasAutoRunFromUrlRef`).

### 3.4 Update state restoration logic

- [ ] In the "Load saved state on mount" effect, extend the "skip if URL params" condition to include `mode=manual&teacher_id&start_date`.
- [ ] Ensure `requestedTeacherId` handling (adding to `selectedTeacherIds`) doesn't conflict. When `mode=manual` is in the URL with `teacher_id`, we want Manual prefill, not Existing filter. So: if `mode=manual` is present, do not add `teacher_id` to `selectedTeacherIds`; use it for `manualTeacherId` only.

---

## Phase 4: Sub Finder State and Manual Form

### 4.1 Prevent overwriting prefilled data

- [ ] When applying URL params, ensure we don't immediately overwrite with `loadSubFinderState()`. Order: URL params first, then saved state only if no relevant URL params.

### 4.2 Sub Finder save state

- [ ] After applying URL params and prefilling, call `saveSubFinderState()` so that if the user navigates away and back, we can restore. The existing `saveSubFinderState` already includes `manualTeacherId`, `manualStartDate`, `manualEndDate`, `manualSelectedShifts`. Ensure the effect that saves state runs after URL-based prefill.

---

## Phase 5: Edge Cases and Polish

### 5.1 Popover size and mobile

- [ ] Test popover on small viewports. If it overflows, consider:
  - Using a Sheet/Modal for mobile instead of Popover.
  - Or `PopoverContent` with `side="bottom"` and scrollable content.
  - Defer to post-MVP if time-constrained.

### 5.2 Accessibility

- [ ] Ensure radio group has proper `aria-label` and `role="radiogroup"`.
- [ ] Each radio has `aria-describedby` pointing to the status message when helpful.
- [ ] Date pickers are keyboard-navigable (DatePickerInput likely already supports this).
- [ ] Focus management: when teacher is selected, move focus to first radio or status message so keyboard users can continue.

### 5.3 Empty teacher list

- [ ] If teachers fetch fails, show message in popover and disable Go. Consistent with current behavior.

### 5.4 School closures

- [ ] No change needed for Phase 1. School closures affect Sub Finder shift logic, not the popover.

---

## Phase 6: Testing

### Find Sub hot button – scenarios covered (see `components/layout/__tests__/Header.FindSub.test.tsx`)

1. **Popover opens** when Find Sub is clicked.
2. **Go disabled** when no teacher is selected.
3. **Teacher with no time off:** Status “has no upcoming time off”; Today, Tomorrow, Custom options; no default selection; Go disabled until one option is selected.
4. **Today + Go:** Navigates to Sub Finder manual with `teacher_id`, `start_date`, `end_date` (today).
5. **Tomorrow + Go:** Navigates to Sub Finder manual with tomorrow’s dates.
6. **Teacher with existing time off:** Status “has existing upcoming time off”; Existing time off list (soonest first) with Covered/uncovered chips; Different dates (Today/Tomorrow/Custom); Go disabled until one option is selected.
7. **Existing absence + Go:** Navigates to `/sub-finder?absence_id=<id>`.
8. **Time-off fetch error:** Fallback message “Couldn’t load time off. You can still find subs for today.”; user can choose Today and Go to manual with dates.

### 6.1 Unit tests

- [ ] Header: mock time-off API, assert correct options shown (no absences vs. has absences).
- [ ] Header: assert correct URL built for each choice (existing vs. today vs. tomorrow vs. custom).
- [ ] Sub Finder: when `mode=manual&teacher_id&start_date&end_date` in URL, assert Manual mode, prefilled teacher and dates, and manualSelectedShifts populated (may need to mock `/api/teachers/:id/scheduled-shifts`).

### 6.2 Integration / E2E

- [ ] Find Sub → select teacher with no time off → choose Today → Go → Sub Finder Manual with today's date and teacher prefilled.
- [ ] Find Sub → select teacher with time off → choose existing absence → Go → Sub Finder Existing with that absence selected.
- [ ] Find Sub → select teacher with time off → choose Different dates → Today → Go → Sub Finder Manual.
- [ ] Error case: mock time-off API failure → assert fallback message and ability to still choose Today and Go.

### 6.3 Manual QA

- [ ] Today and Tomorrow use correct local dates.
- [ ] Custom date: end date defaults to start; validation prevents end before start.
- [ ] 3+ existing absences: layout is usable (scroll or collapse).
- [ ] Refresh on Sub Finder after arriving via URL: state is preserved or gracefully degrades.

---

## Out of Scope (Follow-up)

- **Create time off from Manual coverage:** User will discuss later. Plan assumes we only find subs; creation of time off is separate.
- **Assign sub without time off → temporary coverage:** User clarified that assignment without a time-off request should be framed as "temporary coverage," not "sub." No changes in this plan; handle in a future design.
- **Draft time off for "might be out":** Not in scope. Manual coverage remains the way to explore subs without creating time off.

---

## File Checklist

| File                                         | Changes                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `components/layout/Header.tsx`               | Expand Find Sub popover: fetch time off, status message, radio options, date pickers, updated Go logic                    |
| `app/(dashboard)/sub-finder/page.tsx`        | Read `mode`, `start_date`, `end_date` from URL; prefill Manual form; optionally auto-run finder; adjust restoration order |
| `lib/utils/date.ts`                          | Add `getTodayISO()` and `getTomorrowISO()` if not present (or inline in Header)                                           |
| `lib/utils/date-format.ts`                   | `formatAbsenceDateRange` already exists; use for absence labels                                                           |
| `docs/plans/find-sub-popover-enhancement.md` | This plan                                                                                                                 |

---

## Implementation Order

1. **Phase 1** – Confirm `/api/time-off-requests` usage and add date helpers.
2. **Phase 2** – Header popover UI (state, fetch, options, Go).
3. **Phase 3** – Sub Finder URL handling and Manual prefill.
4. **Phase 4** – State coordination and save/restore.
5. **Phase 5** – Edge cases and accessibility.
6. **Phase 6** – Tests.

---

## Acceptance Criteria

- [ ] User clicks Find Sub → selects teacher → sees correct status (no time off / has existing time off).
- [ ] With no time off: can choose Today, Tomorrow, or Custom → Go → Sub Finder Manual with teacher and dates prefilled.
- [ ] With existing time off: can choose an existing absence or "Different dates" (Today/Tomorrow/Custom) → Go → Sub Finder in correct mode with correct prefill.
- [ ] Custom date: end date defaults to start; both required when Custom is selected.
- [ ] Loading and error states in popover are clear and non-blocking.
- [ ] URL params correctly drive Sub Finder mode and prefill.
- [ ] No regression in existing Sub Finder flows (direct link with `absence_id`, manual entry without URL params).
