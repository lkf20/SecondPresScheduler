# Testing Checklist (Automation-First)

Use this checklist when adding or reviewing feature work.

## 1) Unit Coverage

- [ ] Pure business logic has unit tests
- [ ] Edge cases and invalid inputs are covered
- [ ] Date/time and sorting/grouping logic is deterministic

## 2) API Integration Coverage

- [ ] Route returns correct success payload shape
- [ ] Validation and error status codes are covered
- [ ] Domain invariants are enforced (status transitions, conflict rules)
- [ ] DB-backed behavior is tested against local Supabase where applicable

## 3) Component Coverage

- [ ] Primary interactive states are covered:
  - loading
  - success
  - empty
  - error
- [ ] Form validation + submission flow is tested
- [ ] Important state transitions are tested (open/close, edit/save, assign/remove)

## 4) E2E Coverage

- [ ] A `@smoke` scenario exists for the feature's golden path
- [ ] Critical post-mutation UI updates are asserted
- [ ] Regressions around navigation or data refresh are covered

## 5) CI + Gates

- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run test -- --ci --runInBand` passes
- [ ] `npm run test:e2e:smoke` passes
- [ ] If Phase 1 domain touched, progressive coverage gate passes

## 6) Feature Matrix by Domain

## Time Off + Sub Finder (Phase 1)

- [ ] Create/edit/cancel time-off rules
- [ ] Shift filtering and hydration
- [ ] Coverage/uncovered/partial status correctness
- [ ] Sub matching and assignment state updates

## Weekly/Baseline Scheduling (Phase 2)

- [ ] Assignment ordering/grouping precedence
- [ ] Required/preferred/scheduled calculations
- [ ] Flex add/remove scoped behavior
- [ ] Conflict resolution paths

## Settings + Platform (Phase 3)

- [ ] CRUD + validation for classes/classrooms/timeslots/settings
- [ ] Search/filter/sort behavior
- [ ] Error handling for failed writes/reads
