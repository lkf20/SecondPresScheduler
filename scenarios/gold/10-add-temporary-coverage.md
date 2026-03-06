# Gold Scenario: Add Temporary Coverage

**Status:** Scenario doc for AI-led or human review. Use as checklist for run-length messaging, staffing boundary, long-term card, and header staffing. Implement as unit tests (ScheduleSidePanel, DashboardClient, staffing-boundary) and optionally as `@gold` Playwright tests where high-value.

## Intent

Define “done right” for **Add Temporary Coverage** so behavior is consistent whether the user opens from the **Dashboard** (Below Staffing Target → Add Coverage) or from the **Weekly Schedule** (cell → Add Temporary Coverage). Covers staffing lookahead boundary (12 weeks vs May 14, 2026), run-length Summary card, 8-week long-term suggestion, and header staffing (required, preferred, scheduled).

## Entry points

- **From Dashboard:** User clicks "Add Coverage" on a Below Required or Below Preferred card. Add Temporary Coverage panel opens in flex mode with pre-filled date range and staffing from the selected group.
- **From Weekly Schedule:** User opens a cell and clicks “Add Temporary Coverage.” Panel fetches slot-run for that (classroom, day, time slot) and shows the same Summary card when the slot is below target; date range is pre-filled from the run.

## Review dimensions

### 1. Staffing boundary (12 weeks vs May 14, 2026)

- [ ] **Whichever is sooner:** Staffing lookahead uses the **earlier** of (start date + 12 weeks) and **May 14, 2026**. API and panel use the same rule (e.g. `getStaffingEndDate` in `lib/dashboard/staffing-boundary.ts`).
- [ ] **TODO:** May 14, 2026 is a placeholder; replace with last day of school from School Calendar Settings when available.
- [ ] **Weeks label when capped:** When the run end date is at or after May 14, the copy shows “X weeks” (weeks from run start to May 14). Example: run Mar 9 – May 14 → “10 weeks.”
- [ ] **Weeks label when not capped:** When the run is shorter than 12 weeks, show “X weeks.” When the run spans 12+ weeks and ends before May 14, show “12 or more weeks.”

### 2. Panel header (Required, Preferred, Scheduled)

- [ ] **From Dashboard:** When the panel opens from a Below Staffing Target card, the header shows **Required**, **Preferred**, and **Scheduled** from the group (e.g. “Required: 2 • Preferred: 3 • Scheduled: 1”). No “No staffing target” or “0 scheduled” when coming from dashboard.
- [ ] **From Weekly:** When the panel opens from the weekly schedule with cell data, the header shows staffing from the cell (or from slot-run when in flex without cell data). Staffing numbers are never missing when the slot has targets.

### 3. Summary card (first card)

- [ ] **Same in both entry points:** A white card with header “Summary” shows run-length and suggested coverage range.
- [ ] **Copy:** “[Classroom] [Day] [Slot] is below [required|preferred] target for the next [X weeks | 12 or more weeks]. Suggested coverage range: [start] – [end].”
- [ ] **From Dashboard:** Run and range come from the selected group (initial flex dates and target type).
- [ ] **From Weekly:** Run and range come from slot-run API when the slot is below target; dates are pre-filled from the run.

### 4. Long-term assignment card (8-week marker)

- [ ] **Threshold:** When the chosen (or pre-filled) date range is **≥ 8 weeks**, a separate card shows “Long-term assignment detected” with the suggestion to use the Baseline Schedule instead.
- [ ] **Link:** “Baseline Schedule” is a link to the baseline schedule filtered to the current slot (classroom, day, time slot).
- [ ] **Placement:** This card appears **below** the Summary card and the date/apply-to form, not inside the Summary card.

### 5. API and data

- [ ] **Dashboard overview:** Uses `getStaffingEndDate(startDate)` for staffing target range; same boundary as panel.
- [ ] **Slot-run API:** `GET /api/dashboard/slot-run?classroom_id=&day_of_week_id=&time_slot_id=&start_date=` returns run-length and suggested range using the same 12-week / May 14 boundary. Used when opening Add Temporary Coverage from the weekly schedule.

### 6. Edit temporary coverage (save / confirm)

- [ ] **Edit entry:** In the weekly schedule right panel, temporary coverage assignments (with a staffing event) show an **Edit** button. Clicking it opens the Add Temporary Coverage form pre-filled with the event’s dates, coverage type, staff, and notes.
- [ ] **Single shift:** When the assignment has only one shift (one day/slot/classroom), saving shows a **Confirm change** dialog that summarizes the change with **context-specific** text: classroom name, day name, time slot code, and date or date range (e.g. “Changed from Natalie A. to Cheyenne A. for Infant Room Monday LB March 2 – March 9.”). The changed part (e.g. staff names or coverage type) is **underlined**. If both staff and coverage type change, two lines are shown. User confirms or cancels; no scope choices.
- [ ] **Multiple shifts, no past dates:** When the assignment has more than one shift and the date range has no dates in the past, saving shows an **Apply these changes to** dialog with a single option: **All shifts in this assignment**. User confirms or cancels.
- [ ] **Multiple shifts, with past dates:** When the assignment has more than one shift and the date range includes past dates, the dialog offers: **This shift only**, **This and following shifts**, and **All shifts in this assignment**. User picks one and saves.

### 7. Break coverage

- [ ] **Coverage type:** User can choose **Extra Coverage** (default) or **Break Coverage**. When Break Coverage is selected, a separate subsection (e.g. in a light gray box) shows optional break details.
- [ ] **Teacher taking break (optional):** Dropdown lists baseline teachers in the cell plus **Unspecified**. Unspecified means general lunch/break coverage (no specific teacher); break time can still be set and is shown on the covering person’s chip in the grid and daily print.
- [ ] **Start time / End time (optional):** When provided, shown next to the teacher taking the break (or on the Break Coverage chip when Unspecified) in the weekly grid and daily schedule print (e.g. “☕ 11:00 – 11:30”).
- [ ] **Long-term card:** The “Long-term assignment detected” card is **not** shown when Break Coverage is selected (break coverage is always weekly, not baseline).
- [ ] **Staff list for break:** When Break Coverage is selected, the list of staff who can be assigned includes both **Permanent** and **Flex** staff (availability API receives `event_category: 'break'` and returns both roles).

## Test coverage

| Area                                                                            | Covered by test?  | Notes                                                                                                                                                                                             |
| ------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staffing boundary (getStaffingEndDate, getStaffingWeeksLabel)                   | Yes               | `lib/dashboard/__tests__/staffing-boundary.test.ts`                                                                                                                                               |
| Dashboard passes initial flex staffing to panel                                 | Yes               | `DashboardClient.test.tsx`: panel receives initialFlexRequiredStaff, initialFlexPreferredStaff, initialFlexScheduledStaff                                                                         |
| From dashboard: header shows Required/Preferred/Scheduled                       | Yes               | `ScheduleSidePanel.test.tsx`: Add Temporary Coverage describe                                                                                                                                     |
| From dashboard: Summary card with run-length and range                          | Yes               | `ScheduleSidePanel.test.tsx`                                                                                                                                                                      |
| From dashboard: Long-term card when range ≥ 8 weeks                             | Yes               | `ScheduleSidePanel.test.tsx`                                                                                                                                                                      |
| From weekly: slot-run fetched, Summary shown when below target                  | Yes               | `ScheduleSidePanel.test.tsx`                                                                                                                                                                      |
| Break coverage: Coverage Type, Unspecified, optional fields                     | Skipped           | Feature off (`BREAK_COVERAGE_ENABLED` = false). Test in `ScheduleSidePanel.test.tsx` skipped; re-enable when feature is on.                                                                       |
| Break coverage: API accepts event_category, covered_staff_id, times             | Skipped           | Feature off. Test in `app/api/staffing-events/flex/__tests__/route.integration.test.ts` skipped.                                                                                                  |
| Break coverage: availability returns Permanent + Flex when event_category break | Skipped           | Feature off. Test in `app/api/staffing-events/flex/availability/__tests__/route.integration.test.ts` skipped.                                                                                     |
| Edit temporary coverage: single-shift confirm vs multi-shift scope dialog       | Manual / scenario | Section 6; single-shift shows context-specific summary (classroom, day, slot, date) with change underlined; multi-shift shows scope (all only when no past dates; three options when past dates). |
| E2E: full flow from Dashboard and from Weekly                                   | No                | **Candidate for @gold** Playwright                                                                                                                                                                |

## References

- [04-weekly-schedule-review.md](./04-weekly-schedule-review.md) — Section 7 Temporary coverage (weekly context)
- [lib/dashboard/staffing-boundary.ts](../../lib/dashboard/staffing-boundary.ts) — Boundary and weeks label helpers
- [ScheduleSidePanel.tsx](../../components/schedules/ScheduleSidePanel.tsx) — Add Temporary Coverage UI and initial flex / slot-run usage
