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

## Legends and keys

- **Legends must match implementation.** Whenever a UI includes a legend or key (e.g. shift chip colors, schedule grid overlays), verify that the legend accurately describes the current colors, icons, and labels used in the UI. If you change how something is shown (icon, color, or wording), update the legend in the same change.
- **When making changes:** If the area you’re editing has an associated legend, double-check that the legend is updated so it stays in sync (e.g. add “legend updated” in the PR or commit message when relevant).

## Code review when requested

When the user asks for a code review (e.g. "Review the Sub recommendations code" or "Complete a review of our code for X after these changes"), conduct a structured review and report findings. Use this checklist:

### Code quality

- **Inefficient code** — Unnecessary loops, redundant fetches, avoidable re-renders, or operations that could be simplified.
- **Duplicate code** — Logic or UI that appears in multiple places; consider extracting to a shared helper or component.
- **Error-prone code** — Missing null checks, unhandled edge cases, or lack of defensive coding (e.g. optional chaining, fallbacks).
- **Dead code** — Unused imports, functions, or components that can be removed.

### Errors and robustness

- **User-friendly error messages** — User-facing errors should be clear and actionable (e.g. "Select a date" not "Validation failed"); no stack traces or internal details exposed.
- **Safety checks** — Validate input, handle empty/null, and guard against unexpected data shapes where failures could occur.

### Contracts and scenarios

- **Alignment** — Behavior matches contracts in `docs/contracts/` and scenarios in `scenarios/gold/` (including any relevant checklist).
- **Legends** — If the area has a legend or key, it accurately describes the current UI.

### Checks to run

- **Type check** — `npm run type-check` passes.
- **Lint** — `npm run lint` passes.
- **Unit tests** — Run tests for the affected area; all pass.
- **Gold scenarios** — `npm run test:e2e:gold` or equivalent passes (if gold tests exist for the area).

### Cleanup

- **Remove debug code** — No unnecessary `console.log`, `console.warn`, or temporary debugging code left behind.
- **Remove commented-out code** — Delete or document why it must stay.

### Other

- **Security** — School scope respected; no PII in logs or client; server-side validation where needed.
- **Accessibility** — Semantic markup, focus states, and labels where relevant.
- **AGENTS compliance** — Color system, reusable components, file size, and other rules in this document are followed.

Report what was reviewed, what passed, what was fixed, and what (if anything) needs user decision.

## Code quality and structure

- **Avoid duplication.** Reuse existing logic and components instead of copying code. Before creating a new component, search the codebase for an existing one that already does the job or can be extended.
- **Match the app’s UI.** Use the same patterns, tokens, and components as the rest of the app so new work looks and behaves consistently.

### Adding new UI elements

When adding a new UI element (e.g. a chip, badge, or label):

1. **Check for a reusable component first.** Look in `components/ui/` and shared components (e.g. `StaffingStatusBadge`, `Badge`) for something that already implements the element or can be extended.
2. **If none exists, look for something similar.** Search the codebase for the same or similar concept (e.g. “classroom” chip, “muted label”, “status pill”) to see how it’s implemented elsewhere.
3. **Decide: reuse, extract, or match.**
   - If a reusable component fits, use it.
   - If the same pattern appears in multiple places and would benefit from a single component, consider extracting one.
   - Otherwise, match the existing style/formatting (colors, shape, typography) of the similar UI so the app stays consistent.

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

- **Prefer larger, readable fonts.** Avoid `text-xs` unless it is clearly appropriate (e.g. fine-print, timestamps, or tight secondary labels). Prefer `text-sm` or larger for body copy, labels, and legends so the app stays easy to read.
- **One primary button per page or panel.** Each screen, side panel, or modal should have at most one primary (default-variant) button—the main call-to-action. Use `variant="outline"` or `variant="ghost"` for secondary actions so users can quickly identify the primary action. When multiple actions have equal weight, pick the most important one as primary and demote the rest.
- **Clear, actionable errors.** User-facing error messages should explain what went wrong and what the user can do (e.g. “Select a date” not “Validation failed”). Do not expose stack traces or internal details.
- **Context-specific dialogs, toasts, and modals.** Prefer copy that names the relevant context (e.g. teacher name, date, classroom, time slot) instead of generic wording like “the designated day” or “this shift.” When confirming a change, summarize what changed and where (e.g. “Changed from Natalie A. to Cheyenne A. for Infant Room Monday LB March 2 – March 9.”). Use visual emphasis (e.g. underline) on the changed part when it helps scanning. Apply this to confirmation dialogs, success toasts, and removal/update modals where the user benefits from seeing who, when, and where.
- **Accessibility.** Use semantic markup, visible focus states, and labels so the app is usable with keyboard and assistive tech. When adding UI, follow existing patterns that already support this.
- **Loading and empty states.** Avoid blank or broken-looking screens while data loads or when there is no data; use loading indicators and clear empty-state copy where the app already does.

## Dependencies

- **Prefer the existing stack.** Use Next.js, React, Supabase, Tailwind, and existing libraries unless there is a strong reason to add something new.
- **Justify new dependencies.** If you add a new package, note in the PR why it’s needed and that no existing dependency could cover the use case.

### Tailwind and inline styles

- **Prefer Tailwind utilities for layout and typography** (spacing, flex, rounded, border width, font size). For **colors**, the build may not include every Tailwind color; even static classes like `bg-pink-50` can fail to render if that shade isn’t in the generated CSS.
- **When a color doesn’t appear:** Use inline `style` for that color. Set `backgroundColor`, `color`, and/or `borderColor` as needed (e.g. `style={{ backgroundColor: '#ffe4e6', color: '#db2777', borderColor: '#fb7185' }}`). Keep Tailwind classes for layout and shape (e.g. `rounded-full border border-dashed px-2 py-0.5`).
- **Do not build color class names dynamically** (e.g. `` `bg-${color}-50` ``); JIT/purge may strip them and the styles will not render.
- **For new or non-standard colors** (e.g. a new badge or chip color that must always show), use inline `style` for the color values from the start. Optionally add the color to the Tailwind config/safelist later if you want a reusable class.

### Color consistency

- **Use the centralized color system.** All status, coverage, and staffing colors live in `lib/utils/colors.ts`. Import from there instead of hardcoding Tailwind color classes.
- **Use shared components for staffing badges.** Below Required, Below Preferred, Above Target, and On Target badges must use `StaffingStatusBadge` (`components/ui/staffing-status-badge.tsx`). Do not replicate badge styling in Dashboard, Weekly Schedule panel, or elsewhere.
- **Semantic palette** (see [docs/COLOR_CONSISTENCY_REVIEW.md](docs/COLOR_CONSISTENCY_REVIEW.md)): Red = critical (below required, errors), Orange = uncovered shifts, Amber = warning (below preferred, validation), Yellow = soft (partial coverage, draft).
- **Contact status (pending, contacted, declined):** Use `contactStatusColorValues` in `lib/utils/colors.ts`. Pending = sky blue throughout the app; use the same filled-circle-behind-icon pattern as in Contact Sub panel. See [docs/COLOR_CONSISTENCY_REVIEW.md](docs/COLOR_CONSISTENCY_REVIEW.md) (Contact status colors).
- **Before adding new colors:** Check if an existing constant fits (`staffingColorValues`, `coverageColorValues`, `semanticColors`, `contactStatusColorValues`). If adding a new semantic tier, add it to `lib/utils/colors.ts` and document in `docs/COLOR_CONSISTENCY_REVIEW.md`.
- **Avoid ad-hoc color classes** for status/warning/error states—use the shared constants or components so the app stays visually consistent.
- **Secondary outline buttons (turquoise):** For secondary actions like Find Sub, Update Sub, and similar “go to sub-finder” or teal-accent actions, use `variant="teal"` on the Button component. This gives turquoise border and text with teal fill on hover. Do not use `variant="outline"` with custom teal classes—use the built-in `teal` variant for consistency.

## Workflow

- Work via pull requests. Follow the repo’s branch and commit rules (see `.cursor/rules` if present).
- Before creating or merging a PR, complete the [Pre-PR integrity checklist](docs/guides/PRE_PR_CHECKLIST.md). Use the PR template (Risks, Checks run, Evidence, Tests for non-trivial changes) for every PR.

## School Calendar

- **First and last day of school:** Stored in `schedule_settings.first_day_of_school` and `last_day_of_school`. Managed on the School Calendar settings page (`/settings/calendar`).
- **School closures:** Stored in `school_closures` (date, optional `time_slot_id`, reason). When `time_slot_id` is null, the whole day is closed; when set, only that time slot is closed on that date.
- **Where closures appear:** Weekly schedule grid and baseline schedule show "School Closed" for closed cells. Printable Today's Schedule (on-screen and PDF) shows "School Closed" for closed cells. The weekly schedule legend includes "School Closed" when closures exist.
- **Manage Calendar link:** The weekly schedule page has a "Manage Calendar" button (teal variant) that links to `/settings/calendar`.
- **Helpers:** Use `isCellClosed` (from `lib/utils/school-closures.ts`) for weekly grid cells (needs `weekStartISO`, `dayNumber`, `timeSlotId`). Use `isSlotClosedOnDate` for single-date contexts (daily schedule, PDF). Use `getCellDateISO` (from `lib/utils/date.ts`) to compute the calendar date for a cell given week start and day number.
- **Legends:** If you change how closed cells are shown (e.g. styling or wording), update the "School Closed" legend in the weekly schedule grid.

## Baseline schedule: enrollment and staffing

- **Per-class-group enrollment:** A schedule cell can store enrollment per class group (e.g. Toddler A: 3, Toddler B: 2) in `schedule_cell_class_groups.enrollment`. When any per-class enrollment is set, the total used for ratio is the sum of those values; otherwise the cell’s `enrollment_for_staffing` is used. The grid shows labels like “Toddler A (3), Toddler B (2)” when per-class enrollment is present.
- **Staffing overrides:** A cell can override the auto-calculated required/preferred staff with `schedule_cells.required_staff_override` and `preferred_staff_override` (e.g. for nap time or combined groups). When set, these overrides are used instead of the ratio-based calculation. Use the shared helper `getTotalEnrollmentForCalculation` (from `ScheduleSidePanel`) for total enrollment and apply overrides in all places that compute or display required/preferred staff (ScheduleCell, ScheduleSidePanel, dashboard overview, slot-run, flex availability, baseline-schedule filtering).
- **Legends:** If you add or change how enrollment or staffing targets are shown in the grid or panel, update any related legend or key.

## School Calendar

- **Purpose:** School Calendar lets admins set the first and last day of school and manage closed days (holidays, snow days, etc.). Closed days or time slots appear as “School Closed” across the app.
- **Settings:** `/settings/calendar` — School Year (first/last day) and Closed Days (add/remove closures). Closures can apply to all time slots (whole day) or specific time slots.
- **Data:** `schedule_settings.first_day_of_school`, `schedule_settings.last_day_of_school`; `school_closures` table (`date`, `time_slot_id` nullable — null = whole day, non-null = that slot only).
- **APIs:** `GET/PATCH /api/settings/calendar` (query params `startDate`/`endDate` for closures); weekly-schedule and daily-schedule APIs return `school_closures` for the requested range.
- **Where closures appear:** Weekly Schedule grid (closed cells show “School Closed”); Printable Today’s Schedule (on-screen and PDF); Manage Calendar link on the weekly schedule page.
- **Helpers:** `lib/utils/school-closures.ts` — `isCellClosed(weekStartISO, dayNumber, timeSlotId, closures)` for weekly grid; `isSlotClosedOnDate(dateISO, timeSlotId, closures)` for daily schedule/PDF. `lib/utils/date.ts` — `getCellDateISO(weekStartISO, dayNumber)` for mapping week + day to date.
- **Legends:** When closures exist in the displayed week, the Weekly Schedule legend includes “School Closed.” Keep it in sync if closure styling changes.

## Sub Finder: contact status and per-shift display

- **Do not show declined subs as available.** When a sub’s contact status is “Declined all” (`response_status` / `declined_all`), the Contact Sub panel must not show them as available for any shift: the request summary and shift-assignment cards should show them as unavailable (e.g. gray card border, “Unavailable” chip, no match %). Use the copy “This sub has declined all shifts.” instead of “This sub is available for X of Y remaining shifts.”
- **Refresh when moving off declined.** When the user changes contact status from “Declined all” to “Not contacted”, “Pending”, or “Confirmed”, refresh the contact panel (e.g. via `onAssignmentComplete`) so availability and shift coverage are shown again.
- **Confirmed per shift only.** When showing contacted subs on detail shift cards (e.g. “Show shifts detail”), show a sub as **confirmed** only for the specific shift they are assigned to. If a sub is confirmed/assigned for a different shift in the same absence, treat them as **declined** for all other shifts (they are no longer available for those). Pending and declined_all apply per contact, not per shift.
- **Tests.** ContactSubPanel tests should cover: request summary shows “This sub has declined all shifts.” when status is declined_all; shift cards show unavailable when declined_all; changing from declined to another status triggers refresh.

## Database migrations

To run migrations against the **staging** database:

1. Link to staging: `./scripts/supabase-link.sh staging`
2. Push migrations: `supabase db push`

Run these commands from the project root (`scheduler-app/`). The link script uses `.env.supabase.staging` for the project ref.

## Session and collaboration

- **Check branch at session start.** Before making changes, confirm which branch you are on so work goes to the right place.
- **Commit frequently.** After each logical unit of work (feature slice, fix, refactor), commit with a clear message. Avoid large, multi-topic commits.
- **Keep a list of questions and suggestions.** When something is ambiguous, blocked, or would benefit from your input, add it to the list and tell the user when their review or decision is needed (e.g. "I have 3 items that need your review before merging").

---

**Agent prompt you can use:**  
"Follow AGENTS.md. Make changes via PR. Include evidence + tests. Do not ask me unless a contract/spec is ambiguous."  
When asking for a code review: "Please complete a review of [area]. Follow the 'Code review when requested' checklist in AGENTS.md."
