# Gold Scenario: Warnings vs Errors — “Proceed Anyway”

**Status:** Implemented as `@gold` Playwright test.

## Intent

When the system shows a **warning** (e.g. “A staff member with this name already exists”), the user may choose to proceed anyway (e.g. “Proceed anyway” checkbox). When the system shows an **error** (e.g. required field missing, server error), the user must not be able to submit until the error is resolved. The UI must not allow submission while a warning is unacknowledged if the design requires explicit acknowledgment.

## Contract

- **Warnings:** May show a “Proceed anyway” (or equivalent) control. Submit remains disabled until the user explicitly opts in (e.g. checks the box). After opt-in, submit is allowed.
- **Errors:** No “Proceed anyway.” Submit is disabled until the error condition is fixed.
- **Message specificity:** Warnings and errors must be specific and actionable (per [APP_PURPOSE_AND_CONTEXT.md](../../docs/APP_PURPOSE_AND_CONTEXT.md) — Error Messaging).

## Scope

- Staff form and Teacher form: duplicate-name/email warning with “Proceed anyway” checkbox; submit disabled until checked when duplicate is present.
- Other flows that introduce similar warning patterns should follow the same rule.

## References

- `components/staff/StaffForm.tsx` — duplicate warning, `proceedWithDuplicate`, submit disabled
- `components/teachers/TeacherForm.tsx` — duplicate warning, `proceedWithDuplicate`, submit disabled
- [APP_PURPOSE_AND_CONTEXT.md](../../docs/APP_PURPOSE_AND_CONTEXT.md) — Tone and Expectations, Error Messaging
