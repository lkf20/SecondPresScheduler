## Visual State Spec: Coverage Mode vs Availability Mode

This section defines the canonical visual behavior for shift chips.  
All shift chip UIs must use one of two explicit semantic modes:

- **Coverage Mode**: chip represents the shift's actual coverage state.
- **Availability Mode**: chip represents a specific sub's availability relative to the shift.

Do not mix semantics within a single chip.

---

### Mode Selection Rules

- Use **Coverage Mode** when rendering absence coverage outcomes (e.g. Dashboard time-off card expanded shifts, coverage-focused summaries).
- Use **Availability Mode** when rendering recommendation/eligibility views for a specific sub (e.g. Recommended Subs cards, Contact & Assign availability chips).
- If a surface needs both meanings, render separate chips/rows or clearly separate sections; never overload one chip with dual semantics.

---

### Coverage Mode States

Use shared color tokens from `lib/utils/colors.ts` (`coverageColorValues`).

| State                     | Shift Background / Border                      | Shift Text (`Thu EM`, `Mar 26`)      | Pill                                                                                                                 | Tooltip                                 |
| ------------------------- | ---------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `uncovered`               | `coverageColorValues.uncovered.bg` / `.border` | `coverageColorValues.uncovered.text` | Text: `Uncovered`; uncovered palette; solid border                                                                   | `Uncovered shift`                       |
| `partial` (no assignee)   | `coverageColorValues.partial.bg` / `.border`   | `coverageColorValues.partial.text`   | Text: `Partial`; partial palette; dashed border preferred                                                            | `Partially covered shift`               |
| `partial` (with assignee) | same as partial                                | same as partial                      | `Clock icon + <Sub Name>` (e.g. `Victoria I.`); **uses `coverageColorValues.partialAssignedPill` for the name pill** | `Partial shift assigned to <Sub Name>.` |
| `covered` (no assignee)   | `coverageColorValues.covered.bg` / `.border`   | `coverageColorValues.covered.text`   | Text: `Covered`; covered palette; solid border                                                                       | `Covered shift`                         |
| `covered` (with assignee) | same as covered                                | same as covered                      | `Check icon + <Sub Name>`; **standard teal assigned pill**; solid border                                             | `Assigned to <Sub Name>.`               |

#### Coverage Mode copy rules

- Partial assignment tooltip must use exact pattern:  
  `Partial shift assigned to <Sub Name>.`
- Full assignment tooltip must use exact pattern:  
  `Assigned to <Sub Name>.`
- If `<Sub Name>` already ends in punctuation (`.`, `!`, `?`), do not append an extra period.

---

### Availability Mode States

Use availability/status tokens from shared color system (`shiftStatusColorValues`, plus approved chip styles).

| State                          | Shift Background / Border                                | Shift Text (`Thu EM`, `Mar 26`)           | Pill                                                                                       | Tooltip                                                        |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `assigned` (this sub)          | available palette (soft teal default)                    | available text color                      | `Check icon + this sub name`; **standard teal assigned pill**                              | `Assigned to this sub`                                         |
| `available`                    | available palette (soft teal default)                    | available text color                      | `Uncovered` (if unassigned) or assignee pill if assigned elsewhere and surface supports it | `This sub can cover this shift`                                |
| `unavailable`                  | `shiftStatusColorValues.unavailable.bg` / `.border`      | `shiftStatusColorValues.unavailable.text` | `Uncovered` (status pill style)                                                            | Reason text when present (e.g. `Not qualified for this class`) |
| `assigned elsewhere` indicator | keep base availability/unavailability color for this sub | matches base state                        | show other-sub pill with name when required by surface                                     | `Assigned to <Sub Name>.`                                      |

#### Contact & Assign partial context (availability mode)

- In Contact & Assign (`ContactSubPanel`), a shift that is already `partially_covered` by other subs remains assignable (additive) and must show explicit helper copy that partial coverage already exists.
- If partial assignee time windows are available, show them in contextual copy (for example, `Current partial coverage: Victoria I. (08:00-10:30)`).
- When the selected sub is assigned as partial, assigned-state text must include a partial indicator and optional time window.

#### Availability Mode assigned-pill tokens

- Assigned-sub pills in availability mode must use the standard teal assigned-pill style:
  - `backgroundColor: rgb(204, 251, 241)`
  - `borderColor: rgb(153, 246, 228)`
  - `text/icon color: rgb(15, 118, 110)`
- Do not use the base available-chip background for assigned-sub pills.

#### Coverage Mode named-covered assigned-pill tokens

- In coverage mode, when a shift is fully covered and displays an assignee name, use the same standard assigned-pill tokens:
  - `backgroundColor: rgb(204, 251, 241)`
  - `borderColor: rgb(153, 246, 228)`
  - `text/icon color: rgb(15, 118, 110)`
- Keep partial-assigned chips yellow with clock icon; do not use saturated teal for partial.

---

### Partial Shift Rules (Global)

- Partial is always a **yellow-family semantic** (soft warning tier), never green.
- Partial assignee pill uses a **clock icon**, not a checkmark.
- Full assignee pill uses a **check icon**.
- Multi-partial shifts must not silently collapse to one sub when multiple assignees are available in data:
  - Prefer `assigned_sub_names: string[]` or equivalent canonical array.
  - If UI truncates for space, provide full list in tooltip.
- When partial time windows exist (`partial_start_time`, `partial_end_time`), prefer rendering them in partial summary surfaces (`CoverageSummary`, shift detail rows) using `HH:mm-HH:mm`. **Assign Sub panel** uses friendly 12-hour time in the partial badge (e.g. "9 am to 10:30 am") and a single badge next to the shift label with yellow styling and Clock icon.

### Reassignment (Day-Only Move) Visual Rule

- Reassignment is not partial coverage. Do not reuse partial yellow semantics for reassignment.
- If shown on shift chips, use a distinct "Reassigned" treatment (label/icon) defined by the surface legend.
- Reassignment states must remain distinguishable from:
  - `covered` / `partial` in coverage mode
  - `assigned` / `available` / `unavailable` in availability mode

See: [DAY_ONLY_REASSIGNMENT_CONTRACT.md](./DAY_ONLY_REASSIGNMENT_CONTRACT.md).

---

### Recommended Indicator Rules

- The amber "recommended" corner dot is an **availability/recommendation hint** only.
- Do not display recommended-dot semantics in pure coverage surfaces unless explicitly designed and documented.

---

### Accessibility Requirements

- Any chip with tooltip-only detail must be keyboard reachable:
  - focusable trigger (`button` preferred), or equivalent with keyboard handlers.
- Tooltip text must not be the only way to convey critical state:
  - chip/pill icon + label must independently communicate uncovered/partial/covered.
- Ensure sufficient contrast for chip text against background in all states.

---

### Token & Styling Requirements

- Use centralized tokens from `lib/utils/colors.ts`; avoid ad-hoc hardcoded status hex values.
- If inline style is necessary for reliable rendering, values must still come from centralized token objects.
- Legend/key entries (when present) must match actual chip colors/icons/labels in the same UI.

---

### Ordering Data Contract

- Any API surface that returns rich shift-chip data for coverage rendering (for example Dashboard `coverage_requests[].shift_details`) must include:
  - `date`
  - `time_slot_code`
  - `day_display_order`
  - `time_slot_display_order`
- Consumers must sort chips by:
  - `date` → `day_display_order` → `time_slot_display_order`
- If display-order metadata is unexpectedly missing, chip sort must preserve source input order (stable) rather than applying alphabetical slot-code fallback.

---

### Ordering Checklist (Implementation)

- API layer: include `day_display_order` and `time_slot_display_order` on every shift-chip detail row.
- Client mapping layer: carry those two fields through model/hook/component props without dropping them.
- Chip render layer: call shared sort helper, never ad-hoc alphabetical slot sort.
- Tests: include at least one dashboard API assertion + one UI ordering assertion for same-date multi-slot shifts.

---

### Coverage Mapping Checklist (Recommended Subs)

- In Recommended Subs coverage strips (`SubFinderCard` with `mode="coverage"`), any shift assigned to the current card sub (`assignment_owner = "this_sub"`) must include `assigned_sub_name` (or `assigned_sub_names`) so the pill renders the sub name instead of generic `Covered`.
- If multiple assignees exist (for example two partial subs on the same shift), mapping must preserve the full list in `assigned_sub_names` and pass it through to `ShiftChips`; do not collapse to a single `sub_name`.
- `covered` without assignee name is valid only when assignee identity is genuinely unknown/unavailable in data.
- Add a regression test at the `SubFinderCard` level to assert this mapping.

---

### Acceptance Criteria

A shift-chip implementation is compliant only if:

1. It declares and uses exactly one semantic mode (`coverage` or `availability`).
2. Partial chips render yellow-family styling and clock icon consistently.
3. Tooltip copy follows canonical strings for partial and full assignments.
4. Sorting uses date then DB display order (when display-order metadata exists).
5. Tests cover:
   - partial visual treatment
   - partial tooltip copy
   - ordering by DB display order
   - dashboard API output includes display-order metadata on shift details
   - stable-order fallback when display-order metadata is missing
   - at least one keyboard/tooltip accessibility path
6. Legends (if shown) match implemented chip semantics and visuals.
