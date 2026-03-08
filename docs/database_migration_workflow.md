# Database Migration Workflow (AI + Developer Rules)

This project uses a **two-stage migration workflow** to prevent unfinished database migrations from being accidentally executed.

AI agents and developers MUST follow these rules when creating or modifying migrations.

---

## Core Principle

Only **finished, production-safe migrations** belong in:

`supabase/migrations/`

Work-in-progress migrations must be placed in:

`supabase/migration_drafts/`

Migration runners execute **all files in `supabase/migrations/` in filename order**, so unfinished migrations must never appear there.

---

## Folder Structure

```text
supabase/
  migrations/
    093_staffing_events_table.sql
    094_add_coverage_type.sql

  migration_drafts/
    095_add_partial_coverage_fields.sql
    096_add_break_time_column.sql
```

| Folder                       | Purpose                                   |
| ---------------------------- | ----------------------------------------- |
| `supabase/migrations/`       | Approved migrations that are ready to run |
| `supabase/migration_drafts/` | Work-in-progress migrations               |

---

## Rules for AI Agents

When generating migrations:

1. **Always create new migrations in** `supabase/migration_drafts/`.
2. Do **not** move migrations into `supabase/migrations/` unless explicitly instructed by a human.
3. Do **not** modify previously executed migrations.
4. Always write migrations to be **idempotent when possible**:
   - `ADD COLUMN IF NOT EXISTS`
   - `CREATE INDEX IF NOT EXISTS`
   - `DO $$ BEGIN ... END $$` blocks for enums/constraints/policies

---

## Migration Naming Convention

Migration files must follow this pattern:

`###_short_description.sql`

Examples:

- `093_staffing_events_table.sql`
- `094_add_coverage_type.sql`
- `095_add_partial_coverage_fields.sql`

Where:

- `###` is the next sequential migration number
- `short_description` clearly explains the purpose

---

## Required Header for Every Migration

Every migration must start with a header comment:

```sql
-- MIGRATION 095
-- Purpose: Prepare schema for partial break coverage support
-- Safe to run multiple times: Yes
-- Requires downtime: No
-- Reversible: Yes
```

This helps future debugging and AI understanding.

---

## Migration Approval Process

Before a migration is moved from `migration_drafts/` to `migrations/`:

1. The migration must be reviewed.
2. It must run successfully in the development database.
3. It must be confirmed that the migration does not conflict with existing migrations.

Only then should the file be moved:

```bash
mv supabase/migration_drafts/095_add_partial_coverage_fields.sql supabase/migrations/
```

---

## Preflight Checklist (Recommended)

Before moving a draft migration:

1. Verify the next migration number is unique in `supabase/migrations/`.
2. Run local check: `supabase db reset` (or equivalent dev DB workflow).
3. Run push check: `supabase db push`.
4. Confirm app boot + key flows still work.
5. Confirm no duplicate migration version files exist.

To detect duplicate version prefixes quickly:

```bash
ls supabase/migrations | cut -d_ -f1 | sort | uniq -d
```

If this command prints anything, there is a duplicate migration number that must be resolved.

---

## Checking Which Migrations Have Run

Run this query in Supabase:

```sql
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Or use the CLI:

```bash
supabase migration list
```

Example:

```text
Local | Remote
---------------
093   | 093
094   | 094
095   |
```

This means migration `095` has not yet run remotely.

---

## Important Safety Rules

AI agents and developers MUST NEVER:

- Edit an already executed migration.
- Delete a migration that has been applied to production.
- Reorder migrations.
- Generate migrations directly into `supabase/migrations/`.

If schema changes are needed, create a new migration.

---

## Schema Evolution Strategy

When evolving the schema:

1. Prefer additive changes.
   - Add columns instead of modifying existing ones.
2. Avoid destructive operations unless explicitly approved:
   - `DROP COLUMN`
   - `DROP TABLE`
   - `ALTER TYPE`
3. If a destructive change is required, create a staged sequence:
   - Migration A: add new structure
   - Migration B: migrate data
   - Migration C: remove old structure

---

## Example Migration

```sql
-- MIGRATION 095
-- Purpose: Add break coverage support
-- Safe to run multiple times: Yes
-- Requires downtime: No
-- Reversible: Yes

BEGIN;

ALTER TABLE staffing_events
  ADD COLUMN IF NOT EXISTS coverage_type text NOT NULL DEFAULT 'extra_coverage';

ALTER TABLE staffing_events
  ADD COLUMN IF NOT EXISTS is_partial boolean NOT NULL DEFAULT false;

ALTER TABLE staffing_events
  ADD COLUMN IF NOT EXISTS start_time time;

ALTER TABLE staffing_events
  ADD COLUMN IF NOT EXISTS end_time time;

COMMIT;
```

---

## Summary

| Step | Action                                      |
| ---- | ------------------------------------------- |
| 1    | AI creates migration in `migration_drafts/` |
| 2    | Developer reviews and tests                 |
| 3    | Migration moved to `migrations/`            |
| 4    | Run `supabase db push`                      |
| 5    | Migration recorded in `schema_migrations`   |

---

## Why This Workflow Exists

This workflow prevents:

- accidental execution of unfinished migrations
- schema corruption
- migration ordering bugs
- AI tools pushing experimental migrations

It keeps schema evolution predictable and safe.

---

## Instruction for AI Tools

In system/project instructions, include:

> Follow `docs/database_migration_workflow.md` when generating migrations.
