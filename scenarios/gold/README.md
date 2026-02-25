# Gold Scenarios

These scenarios define **“done right”** behavior for the most expensive regressions. Playwright tests tagged `@gold` implement them; CI runs the gold suite and **PRs cannot merge** unless `@gold` passes.

## Scenarios

| Scenario                                                                                   | Description                                                                                                            | Test    |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------- |
| [01-double-booking-prevention.md](./01-double-booking-prevention.md)                       | Sub assign returns 409 when sub is already assigned to same shift(s); UI shows clear error.                            | `@gold` |
| [02-warnings-vs-errors-proceed-anyway.md](./02-warnings-vs-errors-proceed-anyway.md)       | Warnings (e.g. duplicate staff) allow “Proceed anyway”; errors block. Submit disabled until user acknowledges warning. | `@gold` |
| [03-baseline-weekly-schedule-correctness.md](./03-baseline-weekly-schedule-correctness.md) | Weekly schedule reflects baseline + overlays; assignments and structure load and display correctly.                    | `@gold` |

## Running gold tests

```bash
npm run test:e2e:gold
# or
npm run test:e2e -- --grep @gold
```

**CI:** The `e2e-gold` job runs on every PR. To have gold tests actually run (and block merge on failure), set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in the repo secrets. If those are not set, gold tests are skipped and the job still passes; add "e2e-gold" as a required status check in branch protection once secrets are configured.
