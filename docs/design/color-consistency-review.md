# Color Consistency Review

**Date:** Feb 2026  
**Purpose:** Standardize yellow/amber/orange/red usage across the app for warnings and urgency.

**Status:** Option A implemented (Feb 2026). staffingColorValues = red/amber; semanticColors.error = red; panel-specific override removed; ScheduleCell, StaffingRequirementsDisplay, TeacherMultiSelect, WeeklyScheduleGridNew use amber for below preferred.

---

## Current State Summary

### 1. Centralized Colors (`lib/utils/colors.ts`)

| System                         | Critical / Error      | High Urgency       | Warning                 | Success             |
| ------------------------------ | --------------------- | ------------------ | ----------------------- | ------------------- |
| **semanticColors**             | error → orange        | —                  | warning → yellow        | success → green     |
| **coverageColorValues**        | —                     | uncovered → orange | partial → yellow        | covered → teal      |
| **staffingColorValues**        | below_required → blue | —                  | below_preferred → blue  | above_target → teal |
| **ScheduleSidePanel override** | below_required → red  | —                  | below_preferred → amber | —                   |

### 2. Inconsistencies Found

**Red (critical/error):**

- `semanticColors.error` = **orange** (misleading; "error" typically maps to red)
- ScheduleCell: red ✓ (below required)
- StaffingRequirementsDisplay: red ✓ (below required)
- TeacherCSVUploadModal: red ✓ (errors)
- AssignSubPanel: red ✓ (critical staffing)
- ScheduleSidePanel: red ✓ (below required, via panelStaffingColors)

**Orange:**

- coverageColors.uncovered ✓ (uncovered shifts)
- semanticColors.error (misnamed)

**Amber:**

- ScheduleSidePanel: below_preferred, flex warnings, inactive info ✓
- SubFinderCard, ContactSubPanel, AssignSubPanel: amber alerts ✓
- StaffEditorTabs, ClassroomForm, ClassGroupForm, TimeSlotForm: amber "optional" badges ✓
- ScheduleCell: status 'amber' but displays **text-yellow-600** ❌

**Yellow:**

- coverageColors.partial (partially covered) ✓
- semanticColors.warning ✓
- ScheduleCell: amber status uses yellow-600 ❌
- StaffingRequirementsDisplay: below preferred → yellow-600
- TeacherMultiSelect: below preferred → yellow-600
- EnrollmentInput: yellow-50, yellow-200, yellow-800
- TimeOffForm: yellow for validation
- SubAvailabilitySection: yellow-500, yellow-50, yellow-800
- WeeklyScheduleGridNew: legend amber→yellow-600, red→red-600
- DuplicateResolutionDialog: yellow-600

**Summary of mismatch:**

- "Below preferred" uses **amber** in ScheduleSidePanel but **yellow** in ScheduleCell, StaffingRequirementsDisplay, TeacherMultiSelect
- "Warning" and "partial" both use yellow; "below preferred" mixes amber and yellow
- semanticColors.error = orange is non-standard

---

## Recommended Color Palette

| Tier             | Color      | Tailwind            | Use For                                      | RGB (for inline) |
| ---------------- | ---------- | ------------------- | -------------------------------------------- | ---------------- |
| **Critical**     | Red        | red-600             | Below required staffing, errors, destructive | rgb(220, 38, 38) |
| **High urgency** | Orange     | orange-600          | Uncovered shifts (no sub)                    | rgb(234, 88, 12) |
| **Warning**      | Amber      | amber-700 (muted)   | Below preferred staffing, validation, alerts | rgb(180, 83, 9)  |
| **Soft warning** | Yellow     | yellow-600          | Partially covered, draft, in-progress        | rgb(202, 138, 4) |
| **Success**      | Green/Teal | green-600, teal-600 | Meets target, covered                        | —                |

---

## Recommendations

### Option A: Full Consolidation (Recommended)

**1. Standardize "warning" tier to Amber everywhere**

- Use **amber** for: below preferred staffing, form validation warnings, "needs attention" alerts
- Use **yellow** for: partial coverage, draft status (softer, "in progress")
- Use **red** for: below required, errors
- Use **orange** for: uncovered shifts

**2. Changes required:**

| Location                                    | Current           | Change to                                                          |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `colors.ts` semanticColors.error            | orange            | **red**                                                            |
| `colors.ts` staffingColorValues             | blue              | **red** (below_required), **amber** (below_preferred)              |
| ScheduleCell staffingStatus 'amber' icon    | text-yellow-600   | **text-amber-600**                                                 |
| StaffingRequirementsDisplay below preferred | text-yellow-600   | **text-amber-600**                                                 |
| TeacherMultiSelect below preferred          | text-yellow-600   | **text-amber-600**                                                 |
| WeeklyScheduleGridNew legend amber          | text-yellow-600   | **text-amber-600**                                                 |
| EnrollmentInput hint                        | yellow-200/50/800 | **amber-200/50/800** (if validation) or keep yellow (if soft info) |
| ScheduleSidePanel panelStaffingColors       | —                 | Keep; remove once staffingColorValues updated globally             |
| Remove panelStaffingColors                  | local override    | Consolidate into staffingColorValues                               |

**3. Dashboard**

- Update `staffingColorValues` in colors.ts to red/amber
- Remove `panelStaffingColors` from ScheduleSidePanel; use shared values
- Dashboard + Weekly Schedule + ScheduleCell + StaffingRequirementsDisplay all use same palette

### Option B: Domain-Specific (Minimal Change)

Keep distinct palettes per domain but standardize within each:

- **Coverage (shifts):** orange (uncovered), yellow (partial), teal (covered) — no change
- **Staffing (ratio):** red (below required), amber (below preferred) — align ScheduleCell, StaffingRequirementsDisplay, TeacherMultiSelect to amber
- **Generic alerts:** default to amber for "warning"

Only fix the mismatches (ScheduleCell amber→yellow, StaffingRequirementsDisplay, TeacherMultiSelect) to use amber for below preferred.

---

## Implementation Priority

1. **Phase 1 – Staffing colors:** Update `staffingColorValues` in colors.ts to red/amber; remove `panelStaffingColors` from ScheduleSidePanel. Update Dashboard (already uses staffingColorValues).
2. **Phase 2 – Mismatches:** Fix ScheduleCell, StaffingRequirementsDisplay, TeacherMultiSelect, WeeklyScheduleGridNew to use amber for below preferred.
3. **Phase 3 – Semantic:** Fix semanticColors.error to red (if ever used).
4. **Phase 4 – Alerts:** Audit alert/warning components; standardize to amber for "needs attention", yellow for "soft info".

---

## Files to Update (Phase 1 + 2)

- `lib/utils/colors.ts` — staffingColorValues, semanticColors.error
- `components/schedules/ScheduleSidePanel.tsx` — remove panelStaffingColors, use staffingColorValues
- `components/schedules/ScheduleCell.tsx` — text-yellow-600 → text-amber-600 for amber status
- `components/schedules/StaffingRequirementsDisplay.tsx` — text-yellow-600 → text-amber-600
- `components/schedules/TeacherMultiSelect.tsx` — text-yellow-600 → text-amber-600
- `components/schedules/WeeklyScheduleGridNew.tsx` — legend amber icon: text-yellow-600 → text-amber-600

---

## Shared component: StaffingStatusBadge

Use `StaffingStatusBadge` (`components/ui/staffing-status-badge.tsx`) for all Below Required, Below Preferred, Above Target, and On Target badges. Used in:

- Dashboard (Below Staffing Target section)
- Weekly Schedule side panel (header status, flex metrics)

Do not replicate badge styling—import and use the shared component.

## Contact status colors (sub-finder)

**Pending contact status** uses **sky blue** throughout the app so it is visually distinct from amber/warning and matches the Contact Sub panel. Use `contactStatusColorValues` in `lib/utils/colors.ts`:

- **Contacted:** slate (circle bg + icon) — `contactStatusColorValues.contacted`
- **Pending:** sky blue (circle bg + icon) — `contactStatusColorValues.pending` (sky-50 bg, sky-700 icon)
- **Declined:** rose (circle bg + icon) — `contactStatusColorValues.declined`

Use these values for any UI that shows contact status (e.g. ShiftStatusCard counts, ContactSubPanel badges, detail cards). Prefer a **filled circle behind the icon** (rounded-full, circle bg from the constant, icon color from the constant) to match the Contact Sub panel pattern.

---

## Going forward

When adding or changing UI that conveys status, urgency, or warnings:

1. **Use `StaffingStatusBadge`** for staffing status (below required/preferred, above target, on target).
2. **Use `lib/utils/colors.ts`** — Import `staffingColorValues`, `coverageColorValues`, `semanticColors`, or the appropriate helper for other color needs instead of hardcoding Tailwind color classes.
3. **Admin staff role** — Use `adminRoleColorValues` (violet) for Admin chips on the Staff list and match the Weekly Schedule legend “Admin” chip.
4. **Match the semantic tier** — Red = critical, Orange = uncovered, Amber = warning, Yellow = soft. Do not introduce new ad-hoc colors for these concepts.
5. **If extending the system** — Add new constants to `lib/utils/colors.ts`, include both Tailwind classes and RGB values (for inline styles), and document in this file.
6. **AGENTS.md** — See the "Color consistency" section for agent and contributor instructions.
