# Activity Log Display Contract

This contract defines how audit events MUST be rendered in user-facing Activity surfaces.

## Purpose and Scope

- This contract governs **display wording** for activity messages shown in:
  - Activity page (`/activity`)
  - Header Activity sheet
  - Any future UI that renders activity descriptions.
- This contract is distinct from [AUDIT_LOG_CONTRACT.md](./AUDIT_LOG_CONTRACT.md):
  - `AUDIT_LOG_CONTRACT.md` defines **storage payload quality** (`action`, `details`, names, IDs, etc.).
  - This contract defines **display text quality** (verb tense, capitalization, readability, context).
- Display formatters MUST consume audit data without exposing raw enum/snake_case values.

## Non-Negotiable Rules

1. Messages MUST begin with a capitalized past-tense verb (`Created`, `Updated`, `Deleted`, `Assigned`, `Unassigned`, `Cancelled`, `Resolved`, `Removed`, `Deactivated`).
2. Messages MUST include available context for who/what/where/when when those fields exist in `details`.
3. Display text MUST NOT show raw enum/snake_case tokens (for example `status_change`, `time_off_request`).
4. Known categories/actions in this contract MUST use category-specific formatting (no generic fallback).
5. Fallback text is allowed only for unmapped categories/actions and MUST still satisfy capitalization + past tense.

## Date Formatting Standards

1. Month-day format MUST be `Month D` (for example `April 26`).
2. Same-month ranges MUST be `Month D-D` (for example `April 22-26`).
3. Cross-month same-year ranges MUST be `Month D-Month D` (for example `April 30-May 2`).
4. Cross-year ranges MUST include year on both ends (for example `December 31, 2026-January 1, 2027`).
5. Delimiter for ranges MUST be hyphen (`-`) for consistency with current product wording.
6. Dates are interpreted from stored ISO calendar dates (`YYYY-MM-DD`) and rendered as calendar dates (not time-of-day conversions).

## Category and Action Requirements

### `time_off`

- `create`: MUST render as `Created time off request ...`.
- `cancel`: MUST render as `Cancelled time off request ...`.
- `status_change` / `update`: MUST render as `Updated time off request ...` and include status change context when available.
- Required context when present: `teacher_name`, `start_date`, `end_date`.

### `sub_assignment`

- `assign`: MUST render as `Assigned ...` and include sub/teacher/shift context when available.
- `unassign`: MUST render as `Unassigned ...`; MUST NOT use assign wording.
- If summary text is used, it MUST comply with this contract.

### `coverage`

- Override events MUST render context-rich text, not a generic placeholder.
- Required context when present: `sub_name`, `teacher_name`, override purpose/reason.

### `temporary_coverage`

- `assign`: MUST render as `Assigned ... for temporary coverage ...`.
- `cancel`: MUST render as `Cancelled temporary coverage ...`.
- Include `teacher_name`, `classroom_name`, and date range when available.

### `baseline_schedule`

- `schedule_cell`:
  - `create`: `Created ...`
  - `update`: `Updated ...`
  - `delete`: `Deactivated ...` or `Deleted ...` (must stay past tense and explicit)
- `teacher_schedule`:
  - `assign`: `Assigned ...`
  - `unassign`: `Unassigned ...`
  - `update`: `Updated ...`
  - conflict resolution reason: `Resolved ...`
- Include names for teacher/classroom/day/time slot when available.

### `school_calendar`

- `calendar_settings` `update`: MUST render as `Updated school calendar settings ...`.
- `school_closure`:
  - `create`: MUST render `Created school closure for <date-or-range>`
  - `update`: MUST render `Updated school closure for <date-or-range>`
  - `delete`: MUST render `Deleted school closure for <date-or-range>`
- For slot-specific closures (`whole_day=false`), message MUST append slot codes after the date/range:
  - single: `... for March 9 LB1`
  - multi: `... for March 9 LB1, LB2, AC`
- Slot codes SHOULD come from `details.time_slot_code` (single) or `details.time_slot_codes` (multi) when available.
- Required examples:
  - `Created school closure for April 26`
  - `Created school closure for April 22-26`
  - `Created school closure for March 9 LB1: Staff Meeting`
  - `Created school closure for March 9 LB1, LB2, AC: Staff Meeting`

## Fallback Behavior

- Fallback template for unmapped entries MUST be:
  - `<PastTenseVerb> <HumanizedEntityType>`
- Past tense verb MUST derive from action map; unknown actions default to `Updated`.
- `entity_type` MUST be humanized (replace `_`/`-` with spaces and lower-case words after verb).
- Fallback is FORBIDDEN for categories/actions explicitly listed above.

## Accessibility and Readability

1. Target concise messages (roughly <= 140 characters when practical).
2. Avoid ambiguous references (`it`, `this`) when a concrete subject is available.
3. Preserve interactive staff links where UI supports it (for example teacher/sub names linking to profile pages).
4. Avoid punctuation clutter and repeated clauses.

## Gold and Anti-Examples

### Gold

- `Created school closure for April 26`
- `Created school closure for April 22-26`
- `Created school closure for March 9 LB1: Staff Meeting`
- `Created school closure for March 9 LB1, LB2, AC: Staff Meeting`
- `Unassigned Victoria I. from Anne M. (1 shift)`
- `Assigned coverage override for Victoria I. to cover Anne M.`

### Anti-examples

- `create school closure` (not capitalized, not past tense)
- `status_change time_off_request` (raw enum leakage)
- `Updated coverage details` (too generic when context exists)
- `Assigned sub coverage` for an unassign event (wrong action verb)

## Compliance Matrix (Current Targets)

| Category              | Status      | Notes                                                                  |
| --------------------- | ----------- | ---------------------------------------------------------------------- |
| `time_off`            | Implemented | Uses explicit created/cancelled/updated wording + date context.        |
| `sub_assignment`      | Implemented | Assign/unassign wording separated; unassign cannot display as assign.  |
| `coverage`            | Implemented | Override wording includes sub/teacher context when present.            |
| `temporary_coverage`  | Implemented | Assign/cancel past-tense wording with context.                         |
| `baseline_schedule`   | Implemented | Schedule cell + teacher schedule verbs are explicit and past tense.    |
| `school_calendar`     | Implemented | Calendar settings + school closures have dedicated display rules.      |
| Unmapped new category | Guarded     | Contract-compliant fallback required until category is formally added. |

## Change Management Checklist

When adding a new audit category/entity/action or changing wording:

1. Update this contract with required tokens + examples.
2. Update formatter logic used by Activity UI.
3. Add/adjust formatter unit tests for:
   - verb tense/capitalization
   - context detail
   - date formatting
   - fallback compliance
4. Add/adjust at least one integration-style Activity render test where practical.
5. Confirm `AUDIT_LOG_CONTRACT.md` still provides required data for display.
6. Run `npm run type-check` and affected test suites before merge.
