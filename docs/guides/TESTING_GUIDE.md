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

# E2E smoke
npm run test:e2e:smoke

# Full E2E suite
npm run test:e2e
```

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

## Scripts

- `npm run test` - Jest suite
- `npm run test:coverage` - Jest with coverage
- `npm run test:e2e` - Playwright full suite
- `npm run test:e2e:smoke` - Playwright smoke suite
- `npm run test:e2e:ui` - Playwright UI mode
- `npm run test:e2e:headed` - Playwright headed mode
- `npm run test:all` - Jest + E2E smoke
- `npm run test:db:reset` - reset local Supabase test DB
- `npm run test:db:seed` - seed local Supabase test DB

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
