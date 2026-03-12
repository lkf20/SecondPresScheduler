# Find Sub: Pick Dates Structure – Implementation Plan

Unify the Find Sub popover and Sub Finder left panel to use "Pick dates" label, reorder sections (Pick dates first, Existing time off second), and add Record vs Preview toggle.

---

## Design Decisions

1. **Label:** "Pick dates" in both popover and left panel (replacing "Different dates").
2. **Order:** Pick dates first, Existing time off second.
3. **Toggle:** "Record absence + Assign sub" vs "Preview subs only".
4. **Record:** Add Time Off (prefill teacher, dates, return_to=sub-finder) → create → redirect to Sub Finder with new absence.
5. **Preview:** Go directly to Sub Finder in preview mode (no popover on left panel).

---

## Phase 1: Find Sub Popover (Header)

**File:** `components/layout/Header.tsx`

### 1.1 Rename and reorder

- Change label "Different dates" → "Pick dates".
- Reorder sections: **Pick dates** (Today, Tomorrow, Custom) first, then **Existing time off**.
- When teacher has no absences: only Pick dates section (no Existing time off).

### 1.2 Add Record vs Preview toggle

- Shown when user selects Pick dates (today/tomorrow/custom), not when selecting existing absence.
- **Record absence + Assign sub** (default): Navigate to Add Time Off with prefill → create → redirect to Sub Finder.
- **Preview subs only:** Navigate to Sub Finder with mode=manual, teacher_id, start_date, end_date (no Add Time Off step).

### 1.3 Go button logic

- Existing absence selected → Go → `/sub-finder?absence_id=…` (unchanged).
- Pick dates + Record → Go → `/time-off/new?teacher_id=…&start_date=…&end_date=…&return_to=sub-finder`.
- Pick dates + Preview → Go → `/sub-finder?mode=manual&teacher_id=…&start_date=…&end_date=…&preview=true`.

---

## Phase 2: Shared component (optional)

Extract `FindSubContent` or `FindSubDatePicker` for reuse between Header popover and Sub Finder left panel:

- Teacher search/select
- Pick dates (Today, Tomorrow, Custom)
- Record vs Preview toggle
- Existing time off list (when teacher has absences)

Props: `onGo`, `onRecord`, `onPreview`, `layout: 'popover' | 'panel'`.

---

## Phase 3: Sub Finder Left Panel

**File:** `app/(dashboard)/sub-finder/page.tsx`

### 3.1 Integrated view (no mode toggle)

- **Remove** the Existing Absences / Pick dates mode toggle entirely.
- Single unified view:
  - Teacher search (single select) at top with clear button
  - When teacher selected: **Pick dates** section first (Today, Tomorrow, Custom, Record/Preview toggle, Find subs)
  - **Existing time off** section (that teacher's absences, when any)
  - **Absences list** always visible below, filtered by selected teacher when one is selected
- When no teacher selected: "Select a teacher to search by date" hint; absences list shows all.

### 3.2 Pick dates section (when teacher selected)

- Same options as popover: Today, Tomorrow, Custom.
- Record vs Preview toggle.
- **Record:** Navigate to Add Time Off (prefill) → create → redirect back.
- **Preview:** Run manual finder in-place, show subs in preview mode (no assign, optional banner).

### 3.3 Existing time off section

- List of absences (filtered by selected teacher when teacher selected).
- Click absence → select and run finder (current behavior).

### 3.4 Preview mode support

- Add `preview` URL param: `?preview=true`.
- When preview: show subs, disable Assign, show "Preview only" banner.
- Left panel Preview: stay on page, run finder, show results in preview mode.

---

## Implementation Order

1. **Header:** Rename "Different dates" → "Pick dates", reorder sections. ✅
2. **Header:** Add Record vs Preview toggle and routing logic. ✅
3. **Sub Finder:** Restructure left panel (Pick dates first, Existing time off second). ✅
4. **Sub Finder:** Add preview mode handling. ✅
5. **(Optional)** Extract shared component if duplication warrants it. — Deferred

---

## Time Off Alerts in Sub Finder Left Panel

When the director picks dates and shifts in the Sub Finder left panel:

- **No time off:** Alert + "Create time off request" button. Main page also shows preview banner with same action after Find Subs.
- **Partial overlap:** Box with "Extend existing request" (primary) and "Create new time off request" (secondary).
- **100% overlap:** Helper text only; no extend/create prompt. Find Subs works as-is.

See AGENTS.md "Sub Finder: time off alerts" for details.

---

## Tests (deferred)

- Update Header.FindSub tests for "Pick dates" label and order.
- Sub Finder left panel structure tests.
- E2E for Record vs Preview flows.
