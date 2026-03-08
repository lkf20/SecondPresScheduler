# Gold Scenarios

These scenarios define **“done right”** behavior for the most expensive regressions. Playwright tests tagged `@gold` implement them; CI runs the gold suite and **PRs cannot merge** unless `@gold` passes.

## Scenarios

| Scenario                                                                                   | Description                                                                                                                                                 | Test       |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [01-double-booking-prevention.md](./01-double-booking-prevention.md)                       | Sub assign returns 409 when sub is already assigned to same shift(s); UI shows clear error.                                                                 | `@gold`    |
| [02-warnings-vs-errors-proceed-anyway.md](./02-warnings-vs-errors-proceed-anyway.md)       | Warnings (e.g. duplicate staff) allow “Proceed anyway”; errors block. Submit disabled until user acknowledges warning.                                      | `@gold`    |
| [03-baseline-weekly-schedule-correctness.md](./03-baseline-weekly-schedule-correctness.md) | Weekly schedule reflects baseline + overlays; assignments and structure load and display correctly.                                                         | `@gold`    |
| [04-weekly-schedule-review.md](./04-weekly-schedule-review.md)                             | Thorough review checklist: Weekly Schedule (logic, backend, UI, UX, editing, conflict, flex).                                                               | Checklist  |
| [05-baseline-schedule-review.md](./05-baseline-schedule-review.md)                         | Thorough review checklist: Baseline Schedule (cells, teacher schedules, permanent vs flex, save/refresh).                                                   | Checklist  |
| [07-sub-finder-recommended-cards.md](./07-sub-finder-recommended-cards.md)                 | Sub Finder recommended sub cards: shift chips, legend, contact info (phone/email), coverage bar.                                                            | Checklist  |
| [08-time-off-list-draft-badge-and-status.md](./08-time-off-list-draft-badge-and-status.md) | Time Off list: draft badge on draft requests, request_status from API/transform, list uses request_status for draft vs active, save-as-draft creates draft. | Checklist  |
| [10-add-temporary-coverage.md](./10-add-temporary-coverage.md)                             | Add Temporary Coverage: 12-week/May 14 staffing boundary, Summary card, 8-week long-term card, header staffing; from Dashboard and Weekly Schedule.         | Unit tests |

Scenarios 04, 05, 07, and 08 are **review checklists** for AI-led or human review; implement as `@gold` tests when high-value.

## Prerequisites

1. **Playwright browsers** — Install once:

   ```bash
   npx playwright install
   ```

2. **Test credentials** — Gold tests require a real user to log in. Add to `.env.local`:
   ```
   E2E_TEST_EMAIL=your-test-user@example.com
   E2E_TEST_PASSWORD=your-password
   ```
   If these are not set, gold tests are **skipped** (6 skipped, 0 run). Playwright loads `.env.local` automatically.

## Running gold tests

### Default (Playwright starts the dev server)

```bash
npm run test:e2e:gold
```

Playwright will start `npm run dev` on port 3000 and run tests against it. Stop any dev server first if port 3000 is in use.

### Port 3000 already in use

**Option A: Reuse your existing dev server** (recommended when you already have `npm run dev` running):

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:gold
```

**Option B: Use a different port** (Playwright will start its own server on 3002):

```bash
PORT=3002 npm run test:e2e:gold
```

> **Note:** Option B fails if a dev server is already running, because Next.js uses a lock file (`.next/dev/lock`) that blocks a second instance. Use Option A in that case.

### Other E2E commands

| Command                            | Description                |
| ---------------------------------- | -------------------------- |
| `npm run test:e2e`                 | Run all E2E tests          |
| `npm run test:e2e:smoke`           | Run smoke tests (`@smoke`) |
| `npm run test:e2e -- --grep @gold` | Same as `test:e2e:gold`    |
| `npm run test:e2e:headed`          | Run with visible browser   |
| `npm run test:e2e:ui`              | Open Playwright UI         |

## CI

The `e2e-gold` job runs on every PR. To have gold tests actually run (and block merge on failure), set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in the repo secrets. If those are not set, gold tests are skipped and the job still passes; add "e2e-gold" as a required status check in branch protection once secrets are configured.
