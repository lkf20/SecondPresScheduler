# Pre-PR integrity checklist

Complete this checklist before creating or merging a pull request. It ensures lint, tests, and E2E pass and that your branch is up to date with `main`. For more test commands and coverage expectations, see [TESTING_GUIDE.md](TESTING_GUIDE.md) and [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md).

## 1. Run integrity checks (on your branch)

From the project root (`scheduler-app/`), run in order:

- [ ] `npm run lint`
- [ ] `npm run type-check`
- [ ] `npm run test` (or `npm run test:coverage:phase3` to mirror CI)
- [ ] `npm run test:e2e:smoke` (or `npm run test:all` for Jest + smoke). E2E starts the app on port 3001 by default so it does not conflict with a dev server on 3000.
- [ ] Optionally: `npm run test:e2e:gold` if `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` are set

Fix any failures before opening the PR.

- [ ] **Remove debug code:** No unnecessary `console.log`, `console.warn`, or temporary debugging code left behind (see AGENTS.md).

## 2. Update from main

- [ ] `git fetch origin main`
- [ ] Merge or rebase: `git merge origin/main` (or `git pull origin main`)
- [ ] Resolve any merge conflicts
- [ ] Re-run the same checks (lint, type-check, test, e2e:smoke) after updating

## 3. Open the PR

- [ ] Use the [PR template](../../.github/PULL_REQUEST_TEMPLATE.md): fill in **Summary** (key change list), **Risks**, **Checks run** (check the boxes for the commands you ran), **Evidence**, and **Tests** (for non-trivial changes)
- [ ] Push your branch and open the PR; CI will run lint, type-check, Jest, e2e-smoke, and e2e-gold

## 4. Database migrations

**Staging (before or during PR):**

- From project root: `./scripts/supabase-link.sh staging` then `supabase db push`
- The link script uses `.env.supabase.staging` for the project ref.

**Production:**

- Run migrations **after** the PR is merged to `main`.
- Backup production before applying migrations.
- Link to production (e.g. `./scripts/supabase-link.sh production` if that env and `.env.supabase.production` exist), then `supabase db push`.
- Deploy the app after migrations so schema and code stay in sync.

Test migrations on staging or a copy of production when possible (see [DEVELOPMENT_BEST_PRACTICES.md](DEVELOPMENT_BEST_PRACTICES.md)).

## 5. Optional: deploy to staging before production

Deploy and verify in staging before production. See “Deploy to staging first” in [DEVELOPMENT_BEST_PRACTICES.md](DEVELOPMENT_BEST_PRACTICES.md).
