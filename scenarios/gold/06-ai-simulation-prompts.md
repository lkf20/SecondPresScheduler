# Gold Scenario: AI Simulation Prompts

**Status:** A collection of AI simulation prompts and edge-case scenarios designed to test boundaries, mathematical logic, and filter behaviors in the Weekly and Baseline Schedule implementation.

## Intent

These scenarios are specifically designed to catch subtle rendering logic errors, math calculation boundaries, and state hierarchy conflicts (e.g. inactive parent vs active child). Use these scenarios as a prompt to an AI coding assistant to verify that the frontend and backend implementation correctly handles tricky scheduling situations.

---

## Category 1: Staffing Math & Boundaries

### Scenario 1A: Exact Boundary (Required vs Preferred)

_Tests exact ratio boundary calculations and rounding._

- **Conditions:**
  - Classroom active.
  - Required ratio dictates 2 teachers.
  - Preferred ratio dictates 3 teachers.
  - Currently staffed with exactly 2 Baseline Permanent teachers.
- **Expected Rendering:**
  - Overall cell status badge shows "Below preferred" (amber triangle).
  - Shows 2 Baseline Permanent teacher chips.
- **Possible Inconsistencies:**
  - Math logic or rounding errors making it red ("Below required") or green ("Meets preferred").
- **Edge Cases to Check:**
  - What if staffing is 2.5 because one of the teachers is a "Floater"? Does the system round down, up, or handle floats gracefully?

### Scenario 1B: The Harmless Surplus

_Tests that surplus coverage is handled without alarming UI._

- **Conditions:**
  - Required ratio dictates 2 teachers.
  - Preferred ratio dictates 2 teachers.
  - Currently staffed with 4 teachers (no absences).
- **Expected Rendering:**
  - Overall cell status badge shows "Meets preferred" (green check).
  - 4 Baseline Permanent teacher chips are visible.
  - No alarming or warning UI is present.
- **Possible Inconsistencies:**
  - UI might mistakenly flag "surplus" as an error state or display warning colors.

---

## Category 2: Overlays & Reality (Weekly Only)

### Scenario 2A: The Unfilled Absence

_Tests that removing a teacher via absence dynamically downgrades the cell status._

- **Conditions:**
  - 1 Absence (with no sub assigned).
  - Baseline was exactly at Required (2 teachers).
  - Staffing drops to 1.
- **Expected Rendering:**
  - Absence chip (gray) is shown.
  - An amber warning icon appears on the absence chip indicating no sub is assigned.
  - Overall cell status drops to "Below required" (red X) because the actual coverage is 1, but required is 2.
- **Possible Inconsistencies:**
  - Sub L-bracket connector rendering when no sub exists.
  - Cell status badge failing to recalculate reality and incorrectly staying green based purely on baseline data.
- **Edge Cases to Check:**
  - What if the absent teacher was a floater, not a permanent baseline teacher? Does the math still correctly handle the absence of a fractional resource?

### Scenario 2B: Baseline Flex Covering an Absence

_Tests that valid coverage clears warnings even if it's not explicitly tagged as a "Sub"._

- **Conditions:**
  - 1 Absence (no sub explicitly mapped to that absence).
  - 1 Baseline Flex staff is assigned to the same slot.
  - With the Baseline Flex staff, the total coverage mathematically Meets Preferred.
- **Expected Rendering:**
  - Absence chip (gray) is visible. It will show the amber "no sub" icon because no explicit sub is mapped to it.
  - Baseline Flex chip (blue dashed) is visible.
  - Overall cell status is Green (Meets preferred) because total mathematical coverage is sufficient.
- **Possible Inconsistencies:**
  - System might require a "Sub" to be explicitly mapped to the absence to clear the overall cell warning, ignoring the valid, mathematically sufficient Baseline Flex staff presence.

---

## Category 3: Inactive States & Filtering

### Scenario 3A: Partially Inactive Hierarchy

_Tests that child elements inherit inactivity gracefully without crashing or false-positives._

- **Conditions:**
  - Active Classroom.
  - Active Day.
  - INACTIVE Time Slot.
  - Filter "Show Inactive" is toggled ON.
- **Expected Rendering:**
  - The specific cell appears with a gray background (`SCHEDULE_INACTIVE_CARD_CLASS`).
  - An inactive pill/badge appears on the time slot header.
- **Possible Inconsistencies:**
  - Cell renders as white (active) because the classroom is active (parent vs child inactivity clash).
- **Edge Cases to Check:**
  - What happens if the user attempts to click/edit this effectively inactive cell in the Baseline schedule? (The save button should be disabled).

### Scenario 3B: Strict View Mode Filtering

_Tests that display modes ruthlessly hide irrelevant slots._

- **Conditions:**
  - View Display Mode is set to "Substitutes Only".
  - A specific cell contains: 1 Baseline Permanent Teacher, 1 Absence, and NO Substitutes.
- **Expected Rendering:**
  - The cell is either completely hidden from the grid, or if structural layout requires it, rendered as an empty/null spacer. It should not show the Baseline Permanent Teacher or the Absence.
- **Possible Inconsistencies:**
  - The cell still shows up because the presence of the "Absence" data triggers the visibility logic incorrectly, bypassing the strict "Substitutes Only" filter.
