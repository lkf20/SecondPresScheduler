# Testing Guide

This project uses a balanced test pyramid:

- **Unit tests** for pure logic and utility behavior
- **Integration tests** for API route behavior and data rules
- **Component tests** for high-interaction UI behavior
- **E2E tests** (Playwright) for critical user journeys

## Quickstart

```bash
# Install dependencies
npm ci

# Unit/integration/component tests
npm run test

# Coverage output
npm run test:coverage

# E2E smoke (starts app on port 3001 by default to avoid conflict with dev on 3000)
npm run test:e2e:smoke

# Full E2E suite
npm run test:e2e
```

To use an already-running dev server (e.g. on port 3000) instead of Playwright starting one, set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` before running E2E.

## Local DB Test Harness (Supabase)

Use local Supabase when running DB-backed integration suites.

```bash
# Reset local DB (migrations only)
npm run test:db:reset

# Seed deterministic test fixtures
npm run test:db:seed
```

Seed file:

- `supabase/seed.test.sql`

## Test Layer Conventions

## Unit

- Fast, deterministic, no network/DB
- Table-driven edge cases preferred
- Co-locate tests near implementation when possible

## Integration

- Validate route-level behavior and error contracts
- Favor real query paths against local Supabase where practical
- Mock only external dependencies that are not under test
- **School closures:** Routes that respect school closures (time off, assign-shifts, flex, dashboard) call `getSchoolClosuresForDateRange`. In tests that do not assert closure behavior, mock it to return `[]` (e.g. `jest.mock('@/lib/api/school-calendar', () => ({ getSchoolClosuresForDateRange: jest.fn().mockResolvedValue([]) }))`). When testing closure behavior, override the mock to return closures for specific dates/slots and assert filtering or 409 responses; see AGENTS.md “Testing school closures.”

## Component

- Use RTL + user-event
- Assert visible behavior and user outcomes
- Avoid implementation-detail assertions

## E2E

- Keep smoke suite small and stable
- Use `@smoke` tags for PR-gated subset
- Full suite runs nightly
- Protected-flow smoke specs (Time Off/Sub Finder) require:
  - `E2E_TEST_EMAIL`
  - `E2E_TEST_PASSWORD`
- If those credentials are not set, protected smoke specs are skipped and login smoke still runs

### E2E auth troubleshooting (login did not redirect)

If smoke tests fail with "Login did not redirect away from /login" or time out after clicking Sign in:

1. **Verify login in the same environment**
   - Start the app (`npm run dev`), open `http://127.0.0.1:3000/login` in a normal browser.
   - Sign in with the same `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` from `.env.local`.
   - If that fails, fix credentials or Supabase (user must exist in the same project the app uses).

2. **Same Supabase project**
   - The app must use the same Supabase URL and key as in `.env.local` (and `.env.local` must be in the project root so Playwright loads it). If the app was started with a different env, auth cookies won’t match.

3. **Watch what Playwright does**
   - Run with a visible browser:  
     `npx playwright test --grep @smoke --headed`
   - See whether an error appears on the login page after click (wrong password, etc.) or the page just never redirects.

4. **Slower machine / CI**
   - Initial navigation timeout is 30s, post-login wait 45s. If the app or Supabase is slow, increase timeouts in `tests/e2e/helpers/auth.js` or `playwright.config.js`.

5. **Manual auth capture (if automated login never redirects)**
   - E2E uses a saved auth state so tests don’t log in every run. If the automated setup never redirects off `/login`, capture a session once by hand:
   - Start the app (`npm run dev`). From the project root run:
     `E2E_AUTH_MANUAL=1 npx playwright test tests/e2e/auth.setup.js -g "authenticate-manual" --headed`
   - When the browser opens at `/login`, sign in with `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`. In the Playwright inspector, click **Resume**. The test will save `tests/e2e/.auth/user.json` and exit.
   - After that, run smoke tests as usual; they will use the saved state and no longer perform login.

## One-command QA scripts (Phase 1)

Use these for repeatable verification; AI and contributors can run the same checks and attach proof.

| Script             | What it does                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run qa:smoke` | Boot app (if not already), run Playwright smoke tests (`@smoke`). Same as `test:e2e:smoke`.                                |
| `npm run qa:audit` | Run audit log contract tests (validator + gold/bad examples). Same as `test lib/audit/__tests__/validateAuditLog.test.ts`. |
| `npm run qa:e2e`   | Run full Playwright E2E suite. Same as `test:e2e`.                                                                         |

Typical flow: `npm run qa:smoke` and `npm run qa:audit` for fast checks; `npm run qa:e2e` for full regression.

## QA mode (local / staging)

For manual or AI-driven checks against a known state:

- **Known school:** The default school created by migrations is **School A** (`00000000-0000-0000-0000-000000000001`). After `test:db:reset` and `test:db:seed`, local DB is scoped to this school.
- **Quick login:** Set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` to a user that has a profile for the default school. Use that account to log in and open the app; you land in the known school context.
- **Recent audit logs:** Activity feed and audit log APIs are filtered by `school_id`; with the seeded school, "recent audit logs" are those for School A. Run actions (e.g. create time off, assign sub), then check the feed or DB to verify rows meet [AUDIT_LOG_CONTRACT.md](../contracts/AUDIT_LOG_CONTRACT.md).

## Scripts

- `npm run test` - Jest suite
- `npm run test:coverage` - Jest with coverage
- `npm run test:coverage:phase1` - Phase 1 domain coverage gate
- `npm run test:coverage:phase2` - Phase 2 scheduling coverage gate
- `npm run test:coverage:phase3` - Phase 3 settings coverage gate
- `npm run test:e2e` - Playwright full suite
- `npm run test:e2e:smoke` - Playwright smoke suite
- `npm run test:e2e:ui` - Playwright UI mode
- `npm run test:e2e:headed` - Playwright headed mode
- `npm run test:all` - Jest + E2E smoke
- `npm run test:db:reset` - reset local Supabase test DB
- `npm run test:db:seed` - seed local Supabase test DB
- `npm run qa:smoke` - one-command smoke (see above)
- `npm run qa:audit` - one-command audit contract tests (see above)
- `npm run qa:e2e` - one-command full E2E (see above)
- `npm run test:e2e:gold` - Playwright tests tagged `@gold` (merge gate; see [scenarios/gold/README.md](../../scenarios/gold/README.md))

## Coverage Gates (Progressive)

Phase 1 coverage thresholds are configured in `jest.config.js` and can be enabled via:

```bash
ENFORCE_PHASE1_COVERAGE=true npm run test:coverage
```

Phase 1 targeted domains:

- `app/api/time-off/**`
- `app/api/sub-finder/**`
- `components/time-off/**`
- `components/sub-finder/**`

Thresholds:

- statements/functions/lines: **70%**
- branches: **60%**

Phase 2 scheduling coverage thresholds are configured in `jest.config.js` and can be enabled via:

```bash
ENFORCE_PHASE2_COVERAGE=true npm run test:coverage
```

Phase 2 targeted domains:

- `app/api/staffing-events/**`
- `app/api/teacher-schedules/**`
- `app/api/weekly-schedule/**`

Thresholds:

- statements/functions/lines: **75%**
- branches: **65%**

Phase 3 settings coverage thresholds are configured in `jest.config.js` and can be enabled via:

```bash
ENFORCE_PHASE3_COVERAGE=true npm run test:coverage
```

Phase 3 targeted domains:

- `app/api/schedule-settings/**`
- `app/api/days-of-week/**`
- `app/api/timeslots/**`
- `app/api/class-groups/**`
- `app/api/classrooms/**`
- `components/settings/**`

Thresholds:

- statements/functions/lines: **70%**
- branches: **60%**

CI note:

- GitHub Actions `jest` job enforces phase/domain gates with the matching `ENFORCE_PHASE*_COVERAGE` flags.
- Post-Phase-3 policy:
  - Phase 3 runs at global **75/65** (statements/functions/lines at 75, branches at 65).
  - Phase 1 and Phase 2 remain at **70/60** targeted gates.
