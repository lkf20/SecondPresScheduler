# Instructions for AI and Contributors

This document defines how to work on this codebase so that changes are safe, testable, and aligned with contracts. Follow it when making code or test changes.

## Authority

- **Contracts** in `docs/contracts/` and **scenarios** (e.g. `scenarios/gold/` when added) are the source of truth for intended behavior.
- If a spec or contract is ambiguous, propose a spec/contract change separately (e.g. in a PR or doc section). Do not guess intent.

## When a test fails — stale vs wrong product

- **Wrong product:** The test encodes intended behavior (per contract or scenario) and the app does not match. → Fix the product so it satisfies the contract/spec.
- **Stale test:** The app has intentionally changed (e.g. feature change, UX update) and the test is out of date with current, correct behavior. → Update the test to match the current intended behavior; in the PR, briefly explain why (e.g. "Test expected X; we now do Y by design").
- **Never:** Weaken assertions, remove checks, or make expectations vaguer just to get green. If the only way to pass is to relax the test without a clear "app intentionally changed" reason, treat it as wrong product or ask for clarification.

## Review tests on code changes

For any code change more significant than trivial (e.g. beyond font or color tweaks), review existing tests for the affected area: update tests if they are stale, or add a new test if the change introduces behavior that should be covered. Document in the PR what was reviewed and what was updated or added (or why no test change was needed).

## Audit logs

- New or changed audit logging must satisfy [docs/contracts/AUDIT_LOG_CONTRACT.md](docs/contracts/AUDIT_LOG_CONTRACT.md) and pass the validator in `lib/audit/validateAuditLog.ts`.
- See [docs/contracts/AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md](docs/contracts/AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md) for in-progress call sites.

## Workflow

- Work via pull requests. Follow the repo’s branch and commit rules (see `.cursor/rules` if present).
- Before merging: run lint, type-check, tests, and smoke E2E; include evidence (screenshots or log rows) and tests for behavioral changes.
- Use the PR template (Risks, Checks run, Evidence, Tests for non-trivial changes) for every PR.

---

**Agent prompt you can use:**  
"Follow AGENTS.md. Make changes via PR. Include evidence + tests. Do not ask me unless a contract/spec is ambiguous."
