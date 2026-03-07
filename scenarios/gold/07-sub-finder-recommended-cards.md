# Gold Scenario: Sub Finder — Recommended Sub Cards

**Status:** Checklist for AI-led or human review. Implement as `@gold` tests when high-value.

## Intent

When the director opens Sub Finder and selects an absence, the recommended sub cards must clearly show availability, contact info, and shift chip legend so they can contact and assign subs without confusion.

## Review Dimensions

### 1. Shift chips

- [ ] **Chip layout:** Each shift chip shows: classroom name (uppercase, light gray) above day/slot (e.g. "Mon AM"), date, and status (Assigned Sub, Uncovered, or assigned elsewhere).
- [ ] **Chip size:** Chips are large enough to read (7×9rem) with adequate spacing.
- [ ] **Assigned Sub:** Teal pill with checkmark; indicates this sub is assigned to this shift.
- [ ] **Uncovered:** Light orange pill when no sub is assigned.
- [ ] **Assigned elsewhere:** Gray pill when another sub is assigned.

### 2. Legend

- [ ] **Legend matches implementation:** The legend accurately describes the current chips: Can cover, Cannot cover, Assigned Sub (teal pill with ✓), Recommended assignment (amber dot). No "Other sub" row.
- [ ] **Per AGENTS.md:** When changing shift chip UI, update the legend in the same change.

### 3. Contact info (phone and email)

- [ ] **Source:** Phone and email come from the staff table (same source). Both are returned by the find-subs API and displayed on cards.
- [ ] **Placement:** Phone and email appear at the bottom of the card (in the contact row with an action button). Contact block in the header is hidden (`hideContactInHeader`). Recommended/available cards use "Contact & Assign"; declined cards use "Update" (teal-style button, background matches card on declined).
- [ ] **Formatting:** Phone is formatted with `formatUSPhone`. Email is shown as-is with mailto link when present.
- [ ] **Recommended combination:** Recommended subs (top section) receive email from `SubAssignment` or fallback to full sub data from `allSubs`; email displays when present in the database.

### 4. Coverage bar (header)

- [ ] **Unfilled segments:** Light orange (`rgb(253, 218, 185)`) for uncovered shifts.
- [ ] **Covered segments:** Green tones for fully/partially covered.

### 5. Match percentage

- [ ] **57% match badge:** CheckCircle icon (not exclamation); amber when &lt;100%, emerald when 100%.
- [ ] **Contact status:** Inline with name as pill (e.g. "Not contacted", "Pending", "Confirmed").

## Out of scope

- Assign-shifts API (see 01-double-booking-prevention.md).
- ContactSubPanel flows (notes, assign, decline).
- Manual sub find (different UI path).

## References

- [AGENTS.md](../../AGENTS.md) — Legends rule, color consistency
- [APP_PURPOSE_AND_CONTEXT.md](../../docs/APP_PURPOSE_AND_CONTEXT.md) — Absence → Coverage flow, "Clear contact status"
- `components/sub-finder/ShiftChips.tsx` — Chip layout and legend
- `components/sub-finder/SubFinderCard.tsx`, `SubCardHeader.tsx` — Card layout and contact display
- `lib/utils/sub-combination.ts` — SubAssignment includes email for recommended combinations
