# Supabase Database Migrations

This directory contains the database schema migrations for the Scheduler App.

## Migration Files

1. **001_initial_schema.sql** - Creates all 17 tables with foreign keys, constraints, and triggers
2. **002_add_indexes.sql** - Adds performance indexes for common queries
3. **003_add_rls_policies.sql** - Sets up Row Level Security (RLS) policies
4. **seed.sql** - Initial reference data (time slots and days of week)

## How to Apply Migrations

### Option 1: Using Supabase Dashboard (Recommended for first-time setup)

1. Go to your Supabase project: https://supabase.com/dashboard/project/dxsyowrtvxplaysemati
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file in order:
   - First: `001_initial_schema.sql`
   - Second: `002_add_indexes.sql`
   - Third: `003_add_rls_policies.sql`
   - Fourth: `seed.sql`
4. Run each SQL script

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project
supabase link --project-ref dxsyowrtvxplaysemati

# Apply migrations
supabase db push
```

### Option 3: Using psql

If you have direct database access:

```bash
psql "postgresql://postgres:[PASSWORD]@db.dxsyowrtvxplaysemati.supabase.co:5432/postgres" -f supabase/migrations/001_initial_schema.sql
psql "postgresql://postgres:[PASSWORD]@db.dxsyowrtvxplaysemati.supabase.co:5432/postgres" -f supabase/migrations/002_add_indexes.sql
psql "postgresql://postgres:[PASSWORD]@db.dxsyowrtvxplaysemati.supabase.co:5432/postgres" -f supabase/migrations/003_add_rls_policies.sql
psql "postgresql://postgres:[PASSWORD]@db.dxsyowrtvxplaysemati.supabase.co:5432/postgres" -f supabase/seed.sql
```

## Verification

After applying migrations, verify the tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see all 17 tables:

- classrooms
- classes
- time_slots
- days_of_week
- staff
- teacher_schedules
- sub_availability
- sub_availability_exceptions
- sub_class_preferences
- classroom_preferences
- class_classroom_mappings
- staffing_rules
- enrollments
- time_off_requests
- sub_assignments
- sub_contact_overrides
- sub_contact_log

## Notes

- All tables use UUID primary keys
- Foreign key constraints ensure referential integrity
- Unique constraints prevent duplicate data
- Triggers automatically update `updated_at` timestamps
- RLS policies allow authenticated users to read/write all data (can be restricted later)
