# Weekly Schedule Cell Notes Contract

This contract defines weekly schedule cell notes behavior, data model, and API rules.

## 1) Feature Goal and User Intent

- Directors can keep a reusable baseline note per baseline cell and optionally override the note for one specific date in Weekly Schedule.
- Weekly cell editing should be simple: one clear choice for that date (`Use baseline note`, `Custom note`, or `Hide for this date`).
- Weekly cell display shows one effective note (or none), while preserving baseline context in the editor.

## 2) Explicit Requirements

- In Weekly Schedule cell editor, place a `Notes` card below the `Class Groups, Enrollment & Ratios` card.
- `Notes` card always shows the baseline note (read-only) for that cell.
- Add single-choice control labeled `This date's note` with options:
  - `Use baseline note`
  - `Custom note`
  - `Hide for this date`
- Selecting `Custom note` reveals a text field and focuses cursor in that field.
- Custom note field is prefilled from baseline note when `Custom note` is selected and custom text is empty.
- Show helper text: `Applies only to this date. Baseline note is unchanged.`
- Show `Displayed in this weekly cell` only when the effective note differs from baseline, or when hidden mode is selected.
- Weekly cell UI shows one effective note only; no custom badge/icon is required.

## 3) Implied Requirements (Inferred)

- All reads/writes must be scoped to `school_id`.
- Baseline notes and weekly overrides must never overwrite each other.
- Default behavior for cells with no override must remain unchanged (inherit baseline).
- Weekly notes must work with existing schedule date/cell identity rules.
- Editor behavior must be keyboard-accessible and screen-reader clear.

## 4) Exact State Matrix

Assumption: weekly overrides are stored separately and selected by `override_mode`.

### Field model

- `baseline_note`: read-only source note for baseline cell.
- `weekly_note_mode`: UI enum (`baseline` | `custom` | `hidden`).
- `weekly_custom_note`: UI text field (visible when mode is `custom`).

### Persisted override model

- `override_mode = 'custom' | 'hidden'`
- `note` (required only when `override_mode='custom'`)

### Valid states

1. Mode `baseline`, no override row:
   - Effective note = baseline note.
2. Mode `custom`, `override_mode='custom'`, note non-empty:
   - Effective note = weekly custom note.
3. Mode `hidden`, `override_mode='hidden'`:
   - Effective note = none (hidden for this date).
4. Baseline note empty + mode `baseline`:
   - Effective note = none.

### Invalid/contradictory states

1. `override_mode='custom'` with empty/blank note.
2. `override_mode='hidden'` with non-null note.
3. Multiple override rows for same school/date/classroom/time_slot.
4. Cross-school access to override row.

### Transitions and dependencies

1. `baseline` -> `custom`:
   - Prefill `weekly_custom_note` from baseline note if custom note is empty.
   - Autofocus custom note field.
2. `custom` -> `hidden`:
   - Hide custom note field.
   - Save as `override_mode='hidden'`.
3. `hidden` -> `custom`:
   - Show custom note field; keep last non-empty draft if available.
4. `custom`/`hidden` -> `baseline`:
   - Remove override row on save (revert to baseline inheritance).

## 5) Edge Cases and Failure Modes

1. Concurrent edits by two admins on same cell/date:
   - Risk: last-write-wins surprises.
   - Mitigation: include `updated_at` conflict checks when feasible.
2. Baseline note changes while weekly editor is open:
   - Risk: user edits stale prefill.
   - Mitigation: re-fetch latest on save conflict or refresh before save.
3. Unauthorized/cross-school edit attempts:
   - Must return 403/404 and never leak other school data.
4. Closed-day cell behavior:
   - Editor may still show notes context, but save rules should match existing weekly edit permissions.
5. Accessibility:
   - Radio options and textarea labels must be explicit and linked; focus must move predictably.

## 6) UI Rules Mirrored by Server/DB

- Server must enforce:
  - School scope authorization.
  - Override mode validity.
  - Note validation rules for custom mode.
  - Single override per cell/date key.
- DB must enforce:
  - Unique key for one override per cell/date.
  - Check constraints for mode/note consistency.

## 7) Simplest UX (By Design)

- Notes card layout:
  - `Baseline note` (read-only, always visible; show `No baseline note` when empty)
  - Radio choice group: `Use baseline note`, `Custom note`, `Hide for this date`
  - Helper text: `Applies only to this date. Baseline note is unchanged.`
  - Textarea (visible only when `Custom note` is selected)
  - Conditional preview card `Displayed in this weekly cell` only when effective note differs from baseline or mode is hidden
- Weekly cell rendering:
  - If hidden override -> show no note.
  - Else if custom override -> show custom note.
  - Else -> show baseline note.

## 8) Test Coverage Plan

### Happy paths

- Uses baseline note when no override exists.
- `Custom note` saves and displays in weekly cell.
- `Hide for this date` saves hidden override and displays no note.
- `Use baseline note` removes override row and inherits baseline note.

### Invalid states

- Reject save when mode is `custom` and note is blank.
- Reject payloads with invalid mode.
- Reject cross-school updates.

### Transition tests

- `baseline` -> `custom` prefill and autofocus.
- `custom` -> `hidden` -> `custom` preserves draft behavior.
- `custom`/`hidden` -> `baseline` removes override and reverts to baseline.

### Regression tests

- Baseline notes remain unchanged when weekly override is edited.
- Existing cells without overrides render exactly as before.
- Weekly note retrieval joins do not duplicate or cross-contaminate rows.
- Preview card visibility follows contract (shown only when effective differs from baseline or hidden mode).

## 9) Open Decisions and Recommendations

- Decision A (resolved): blank custom note vs explicit hide mode.
  - Recommendation: explicit `Hide for this date` mode is clearer and less error-prone than blank-note semantics.
- Decision B (resolved): prefill custom note when selecting custom mode.
  - Recommendation: Yes.
- Decision C (resolved): stale baseline change warning.
  - Recommendation: No warning in this release.

## 10) Backend Requirements (Including Migrations)

### Database

Create new table (override-only storage):

- `weekly_schedule_cell_notes`
  - `id uuid primary key default gen_random_uuid()`
  - `school_id uuid not null`
  - `date date not null`
  - `classroom_id uuid not null`
  - `time_slot_id uuid not null`
  - `override_mode text not null check (override_mode in ('custom','hidden'))`
  - `note text null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - optional: `created_by uuid`, `updated_by uuid` (if following existing audit actor pattern)

Constraints:

- Unique: `(school_id, date, classroom_id, time_slot_id)`
- Check:
  - `override_mode='custom'` -> `note` must be non-null, trimmed length > 0
  - `override_mode='hidden'` -> `note` must be null

Indexes:

- `(school_id, date)` for weekly range fetches
- unique key above

RLS:

- Mirror schedule table policies so only users in same school can select/insert/update/delete.

### API Contract

Weekly schedule read response per cell must include:

- `baseline_note: string | null`
- `weekly_note_override: { override_mode: 'custom' | 'hidden'; note: string | null } | null`
- Derived in server or client:
  - `effective_note: string | null`
  - `is_note_hidden_for_date: boolean`

Weekly cell note update payload:

```json
{
  "date": "2026-03-05",
  "classroom_id": "uuid",
  "time_slot_id": "uuid",
  "use_baseline_note": false,
  "override_mode": "custom",
  "note": "Anne M. arrives at 11:30am."
}
```

Rules:

1. `use_baseline_note=true`:
   - Ignore `override_mode`/`note`, delete existing override row if present.
2. `use_baseline_note=false`:
   - Require `override_mode`.
   - `override_mode='custom'` requires valid non-empty `note`.
   - `override_mode='hidden'` requires null/empty `note` and persists null note.
3. Upsert by unique key; update `updated_at`.

Suggested server error statuses:

- `400` invalid payload/state
- `403` unauthorized school scope
- `404` missing parent cell context (if applicable)
- `409` conflict on optimistic concurrency guard (optional)

### Non-goals for this release

- No baseline-change-vs-override warning banner.
- No custom-note indicator badge in weekly cells.
