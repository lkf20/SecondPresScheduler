# Supabase Database Migrations

This directory contains the database schema migrations for the Scheduler App. The current schema is the result of applying all migrations in order (001 through the latest, e.g. 112). **When adding or changing a migration, update this README and [docs/reference/DATABASE_SCHEMA.md](../docs/reference/DATABASE_SCHEMA.md) as needed** (see AGENTS.md → Database migrations). The initial migration (001) created 17 tables; later migrations add, alter, and remove tables and columns. For a full list of current tables and their roles, see [docs/reference/DATABASE_SCHEMA.md](../docs/reference/DATABASE_SCHEMA.md).

## Migration Files

Migrations in `migrations/` are applied in numeric order:

- **001_initial_schema.sql** – Creates the original 17 tables with foreign keys, constraints, and triggers
- **002** through **107** – Add tables (e.g. schedule_cells, coverage_requests, schools, profiles, audit_log, school_closures), add columns and indexes, add RLS, drop deprecated tables, and other schema changes
- **110** – coverage_requests counters: cap covered_shifts when total_shifts changes so the check constraint always passes
- **111** – covered_shifts trigger: resolve coverage_request via coverage_request_shift_id (no (date, time_slot_id, teacher_id) lookup)
- **112** – coverage_requests cap logging: RAISE NOTICE when covered_shifts is capped (for monitoring)
- **seed.sql** – Optional initial reference data (e.g. time slots and days of week; some reference data is also seeded in migrations such as 007)

**Do not apply only 001–003** and stop; that leaves you with an outdated schema. Use the Supabase CLI to apply the full migration set (see below).

## How to Apply Migrations

### Option 1: Using Supabase CLI (recommended)

Apply all migrations in one go:

```bash
# From project root (scheduler-app/)
./scripts/supabase-link.sh staging   # or link to your project
supabase db push
```

This runs migrations 001 through the latest in order. For staging, the link script uses `.env.supabase.staging` for the project ref.

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard.
2. Navigate to **SQL Editor**.
3. Run each migration file in order: `001_initial_schema.sql`, then `002_add_indexes.sql`, and so on through the latest migration. Running only the first few migrations will leave the schema incomplete and out of sync with the app.

### Option 3: Using psql

If you have direct database access, run each migration file in order:

```bash
for f in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

After migrations, you can run `seed.sql` if you need the optional reference data it provides.

## Verification

After applying all migrations, you can verify that the expected tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see the current set of tables (31 as of this writing), including for example:

- audit_log, class_groups, classroom_allowed_classes, classrooms, coverage_request_shifts, coverage_requests, days_of_week, profiles, qualification_definitions, schedule_cell_class_groups, schedule_cells, schedule_settings, school_closures, schools, staff, staff_qualifications, staff_role_type_assignments, staff_role_types, staffing_event_shifts, staffing_events, sub_availability, sub_availability_exception_headers, sub_availability_exceptions, sub_assignments, sub_contact_shift_overrides, sub_class_preferences, substitute_contacts, teacher_schedules, time_off_requests, time_off_shifts, time_slots

For the full, up-to-date list and descriptions, see [docs/reference/DATABASE_SCHEMA.md](../docs/reference/DATABASE_SCHEMA.md). Tables such as `classes`, `class_classroom_mappings`, `staffing_rules`, `sub_contact_overrides`, and `sub_contact_log` no longer exist (removed in later migrations).

## Notes

- All tables use UUID primary keys.
- Foreign key constraints ensure referential integrity.
- Unique constraints prevent duplicate data where appropriate.
- Triggers automatically update `updated_at` timestamps on many tables.
- RLS policies enforce school-scoped access where applicable.
