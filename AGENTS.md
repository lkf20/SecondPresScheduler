# Instructions for AI and Contributors

This document defines how to work on this codebase so that changes are safe, testable, and aligned with contracts. Follow it when making code or test changes.

## Purpose and context

For the app’s purpose, intended users, and key flows, see [docs/APP_PURPOSE_AND_CONTEXT.md](docs/APP_PURPOSE_AND_CONTEXT.md). Consult it when making product or UX decisions so changes align with intent. Add or update context there when the product evolves.

## Authority

- **Contracts** in `docs/contracts/` and **scenarios** (e.g. `scenarios/gold/` when added) are the source of truth for intended behavior.
- If a spec or contract is ambiguous, propose a spec/contract change separately (e.g. in a PR or doc section). Do not guess intent.

## When a test fails — stale vs wrong product

- **Wrong product:** The test encodes intended behavior (per contract or scenario) and the app does not match. → Fix the product so it satisfies the contract/spec.
- **Stale test:** The app has intentionally changed (e.g. feature change, UX update) and the test is out of date with current, correct behavior. → Update the test to match the current intended behavior; in the PR, briefly explain why (e.g. "Test expected X; we now do Y by design").
- **Never:** Weaken assertions, remove checks, or make expectations vaguer just to get green. If the only way to pass is to relax the test without a clear "app intentionally changed" reason, treat it as wrong product or ask for clarification.

## Review tests on code changes

For any code change more significant than trivial (e.g. beyond font or color tweaks), review existing tests for the affected area: update tests if they are stale, or add a new test if the change introduces behavior that should be covered. Document in the PR what was reviewed and what was updated or added (or why no test change was needed).

## Code quality and structure

- **Avoid duplication.** Reuse existing logic and components instead of copying code. Before creating a new component, search the codebase for an existing one that already does the job or can be extended.
- **Match the app’s UI.** Use the same patterns, tokens, and components as the rest of the app so new work looks and behaves consistently.
- **Keep files small.** Prefer files under 200–300 lines. Split large files into smaller modules or components; extract shared logic into helpers or hooks.
- **Keep the codebase clean and organized.** Put new code in the right place (e.g. shared components in `components/`, API logic in `app/api/` or `lib/`). Avoid one-off or dead code.
- **Organize CSS and design assets.** Use shared styles, design tokens, or a consistent system (e.g. Tailwind, CSS modules) so styles are reusable and easy to maintain.

## Audit logs

- New or changed audit logging must satisfy [docs/contracts/AUDIT_LOG_CONTRACT.md](docs/contracts/AUDIT_LOG_CONTRACT.md) and pass the validator in `lib/audit/validateAuditLog.ts`.
- See [docs/contracts/AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md](docs/contracts/AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md) for in-progress call sites.

## Security, privacy, and data

- **Scope by school.** All data access must respect `school_id` (or equivalent); never expose or mutate data for another school.
- **No sensitive data in logs or client.** Do not log or send PII, passwords, or tokens. Audit logs may include names for “who did what” where the contract allows; do not add new PII beyond what the audit contract requires.
- **Validate on the server.** Assume client input is untrusted. Authorize and validate in API routes or server code; do not rely on client-only checks for security or data integrity.

## User experience and robustness

- **Clear, actionable errors.** User-facing error messages should explain what went wrong and what the user can do (e.g. “Select a date” not “Validation failed”). Do not expose stack traces or internal details.
- **Accessibility.** Use semantic markup, visible focus states, and labels so the app is usable with keyboard and assistive tech. When adding UI, follow existing patterns that already support this.
- **Loading and empty states.** Avoid blank or broken-looking screens while data loads or when there is no data; use loading indicators and clear empty-state copy where the app already does.

## Dependencies

- **Prefer the existing stack.** Use Next.js, React, Supabase, Tailwind, and existing libraries unless there is a strong reason to add something new.
- **Justify new dependencies.** If you add a new package, note in the PR why it’s needed and that no existing dependency could cover the use case.

## Workflow

- Work via pull requests. Follow the repo’s branch and commit rules (see `.cursor/rules` if present).
- Before merging: run lint, type-check, tests, and smoke E2E; include evidence (screenshots or log rows) and tests for behavioral changes.
- Use the PR template (Risks, Checks run, Evidence, Tests for non-trivial changes) for every PR.

## Session and collaboration

- **Check branch at session start.** Before making changes, confirm which branch you are on so work goes to the right place.
- **Commit frequently.** After each logical unit of work (feature slice, fix, refactor), commit with a clear message. Avoid large, multi-topic commits.
- **Keep a list of questions and suggestions.** When something is ambiguous, blocked, or would benefit from your input, add it to the list and tell the user when their review or decision is needed (e.g. "I have 3 items that need your review before merging").

---

**Agent prompt you can use:**  
"Follow AGENTS.md. Make changes via PR. Include evidence + tests. Do not ask me unless a contract/spec is ambiguous."
