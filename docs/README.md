# Documentation

This directory contains all project documentation organized by type. All project .md files live under `docs/<type>/` (or in repo root only if they are README, AGENTS, ROADMAP, or TODO_TRACKER), with consistent kebab-case names. Keep this index up to date when adding or moving docs.

## Purpose and context

- **[domain/app-purpose-and-context.md](domain/app-purpose-and-context.md)** — Who the app is for, what problem it solves, key flows, and product intent. Consult when making product or UX decisions; [AGENTS.md](../AGENTS.md) references it.

## Structure

### `/domain`

Product and domain rules (source of truth for intent and data lifecycle):

- **app-purpose-and-context.md** — Product intent, key flows, design guardrails
- **data-lifecycle.md** — Status transitions, ownership, and invariants for coverage_requests, time_off_requests, sub_assignments

### `/design`

UI and color standards, consistency reviews, and progress tracking:

- **color-consistency-review.md** — Semantic palette (red/amber/yellow/orange), staffing badges, contact status colors
- **ui-color-standardization.md** — Centralized color system and usage guidelines
- **ui-color-update-progress.md** — Component update status
- **ui-color-analysis.md** — Analysis and recommendations for color consistency

### `/guides`

Development guides and how-to documentation:

- **DEVELOPMENT_BEST_PRACTICES.md** — Best practices for development workflow
- **ERROR_HANDLING_GUIDE.md** — Guide for consistent error handling
- **SETUP.md** — Project setup and installation instructions
- **PRE_PR_CHECKLIST.md** — Integrity checklist before creating or merging a PR
- **TESTING_CHECKLIST.md** — Checklist for testing features
- **TESTING_GUIDE.md** — Guide for writing and running tests
- **SUB_FINDER_DEBUGGING.md** — Sub Finder debugging tips
- **INACTIVE_ENTITY_QA_MATRIX.md** — QA matrix for inactive-entity behavior
- **database-migration-workflow.md** — Rules for draft vs approved migrations, numbering, safety checks, and approval workflow
- **testing-coverage-requests-migration.md** — How to test the coverage_requests migration
- **unified-time-off-api-testing.md** — Testing guide for GET /api/time-off-requests

### `/reference`

Reference documentation for APIs and schemas:

- **API_ROUTE_PATTERNS.md** — API route patterns and conventions
- **DATABASE_SCHEMA.md** — Database schema documentation

### `/contracts`

Formal contracts and quality standards (see [contracts/README.md](contracts/README.md)):

- **AUDIT_LOG_CONTRACT.md** — Audit log entry shape and rules
- **AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md** — Call site compliance backlog
- **DAY_ONLY_REASSIGNMENT_CONTRACT.md** — Day-only staff reassignment rules (source->target), optional absence-coverage linkage, lifecycle, and validation
- **SCHEDULE_SEMANTICS_CONTRACT.md** — Weekly/Baseline schedule invariants
- **WEEKLY_SCHEDULE_CELL_NOTES_CONTRACT.md** — Weekly cell notes contract: baseline note inheritance, date-specific custom/hide overrides, API payload and migration constraints

### `/plans`

Feature and refactor plans:

- **temporary-coverage-refactor.md**
- **find-sub-pick-dates-structure.md**
- **find-sub-popover-enhancement.md**

### `/archive`

One-off or historical analyses (kept for reference):

- **comparison-dashboard-routes.md** — Deleted vs new dashboard overview route
- **deleted-routes-analysis.md** — Analysis of deleted API routes

## Root documentation

The following documentation files remain in the project root:

- **README.md** — Main project readme
- **AGENTS.md** — Instructions for AI and contributors
- **ROADMAP.md** — Project roadmap and future plans
- **TODO_TRACKER.md** — Active TODO items and feature tracking
