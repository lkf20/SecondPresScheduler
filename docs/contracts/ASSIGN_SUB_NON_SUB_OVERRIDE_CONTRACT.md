# Assign Sub Non-Sub Override Contract

Use this contract when implementing or modifying the "Assign Sub" director override flow that allows assigning active non-sub staff to cover absence shifts.

## Goal

Enable directors to quickly cover absence shifts when no substitute is available by assigning a non-sub staff member, while keeping coverage status, conflict safety, and audit traceability intact.

## Scope

- Assign Sub panel (`components/assign-sub/AssignSubPanel.tsx`)
- Assign-shifts API (`app/api/sub-finder/assign-shifts/route.ts`)
- Related contact flow (`app/api/sub-finder/substitute-contacts/route.ts`, `lib/api/substitute-contacts.ts`)
- Audit logging for assignment/unassignment
- Any surfaces that render assignment details for absence coverage

## Definitions

- **Sub assignment**: Row in `sub_assignments` representing absence coverage.
- **Non-sub override**: A `sub_assignments` row where the assigned `staff` member is not flagged as `is_sub=true` at assignment time, and the director intentionally used override.
- **Override marker**: Persisted metadata on assignment row indicating this was a non-sub override.

## Product Rules

1. **Explicit override only**

- Non-sub assignment is allowed only when user explicitly enables override in UI.
- API must require explicit override intent flag for non-sub assignees.

2. **Who can be assigned**

- Any active staff in the same school can be assigned via override (includes admin staff).
- Inactive staff cannot be assigned.

3. **Coverage behavior**

- Non-sub override assignment must count as covered absence the same way standard sub assignment does.
- Existing one-active-assignee-per-coverage-shift behavior remains unchanged.

4. **Conflict behavior**

- Existing conflict logic applies unchanged (`conflict_sub`, `conflict_teaching`, floater/move rules, closed-day rejection).
- Non-sub override does not bypass hard conflicts.

5. **Contact semantics**

- Do not create or update `substitute_contacts` as "contacted/confirmed" for non-sub override assignments.
- Sub contact workflows remain for true substitute workflows.

6. **Transparency**

- Weekly Schedule cells do not show override badge (space constraint).
- Show "Non-sub staff override" indicator in high-context locations:
  - Assign Sub panel (selected assignee + confirmation copy)
  - Change-sub/assignment detail dialogs
  - Activity feed entry details
  - Daily Schedule report does not show a dedicated override icon/tooltip in cell rows

## State Model

### Valid states

- `candidate_is_sub=true` (standard flow)
- `candidate_is_sub=false` + `allow_non_sub_override=true` (override flow)

### Invalid states

- `candidate_is_sub=false` + no override intent flag
- candidate is inactive
- candidate school mismatch
- closed shift selected
- unresolved hard conflict selected for assignment

### Transition rules

- Override toggle off -> on: expands assignee options to include non-sub active staff.
- Override toggle on -> off with non-sub selected: clear selection and require reselection.
- Assign request success: writes assignment rows + audit event; no substitute_contact write for non-sub override.

### Field dependencies

- `allow_non_sub_override` is required when assignee is non-sub.
- Override marker on assignment row auto-set server-side when non-sub override used.
- UI override badge/label derives from assignment marker, not current staff `is_sub` value.

## Server And Data Contract

### Request contract (assign-shifts)

- Extend request payload with:
  - `allow_non_sub_override: boolean` (default false)

### Validation contract

- Resolve assignee staff row.
- Enforce:
  - same school
  - `active !== false`
  - if `is_sub !== true`, then `allow_non_sub_override === true`

### Persistence contract

- Continue inserting into `sub_assignments` for absence coverage compatibility.
- Persist override marker for non-sub override rows.
- Continue existing replacement logic and status/counter updates.

### Audit contract

- Assignment and unassignment events must include override context in `details` when applicable, e.g.:
  - `non_sub_override: true`
  - `assignee_is_sub: false`

## Migration Requirements

Add persisted override metadata to `sub_assignments`.

Recommended minimal migration:

- `non_sub_override boolean not null default false`

Optional extension:

- `override_source text null` (e.g. `director_override_non_sub`)

No destructive migration required.

## Failure Modes To Guard Against

- Stale shift selections (cancelled/closed after load)
- Concurrent replace operations for same shift
- False "unavailable" warnings from missing sub availability rows on non-sub staff
- Cross-school assignment attempts
- Misleading contact history for non-sub override assignments

## Test Requirements

### Happy path

- Assign active non-sub with override flag -> success, covered status, audit marker present.
- Assign standard sub unchanged.

### Invalid path

- Non-sub without override flag -> rejected.
- Inactive/cross-school assignee -> rejected.
- Closed day assignment -> rejected.

### Transition/regression

- Override toggle clears non-sub selection when disabled.
- Conflict resolution requirements unchanged for override assignees.
- Non-sub assignments skip substitute_contact confirmation writes.
- Existing sub-finder/assign-sub flows for true subs remain green.

## Open Design Note (V2)

`assignment_type` currently remains `"Substitute Shift"` for compatibility even when non-sub override is used. In V2, consider a clearer type model while preserving existing reporting compatibility.
