# WARNING:
# This script copies data FROM PROD → STAGING.
# Once real school data is in production, be sure you are allowed
# to clone it into staging, or switch staging to fake/seed data instead.

#!/usr/bin/env bash
set -euo pipefail

# EDIT THESE for your environment
PROD_DB_URL="postgresql://postgres:FEFlJOoyD1mDL6Ks@db.dxsyowrtvxplaysemati.supabase.co:5432/postgres"
STAGING_DB_URL="postgresql://postgres:DzdHiph92o7g5EYI@db.ifruemnmzfzgwlgrhwfg.supabase.co:5432/postgres"

DUMP_DIR="db_dumps"
mkdir -p "$DUMP_DIR"

# Core tables you actually have (based on your list)
TABLES=(
  schools
  schedule_settings
  days_of_week
  time_slots
  classrooms
  class_groups
  class_classroom_mappings
  classroom_allowed_classes

  # staff + related
  staff_role_types
  staff
  qualification_definitions
  classroom_preferences
  staff_qualifications

  # ratios / enrollments / baseline schedule
  staffing_rules
  enrollments
  teacher_schedules
  schedule_cells
  schedule_cell_class_groups

  # time off + coverage
  time_off_requests
  time_off_shifts
  coverage_requests
  coverage_request_shifts
  sub_assignments

  # sub availability & preferences
  sub_availability
  sub_availability_exception_headers
  sub_availability_exceptions
  sub_class_preferences

  # sub contact / follow-up
  substitute_contacts
  sub_contact_log
  sub_contact_overrides
  sub_contact_shift_overrides
)

echo "Syncing core data from PROD → STAGING…"

for table in "${TABLES[@]}"; do
  echo "--------------------------------------------------"
  echo "Syncing table: $table"

  # 1) Dump data for this table from PROD
  pg_dump "$PROD_DB_URL" \
    --data-only \
    --table="public.$table" \
    > "$DUMP_DIR/prod-$table.sql"

  # 2) Truncate table in STAGING (if it exists)
  psql "$STAGING_DB_URL" \
    -c "TRUNCATE TABLE \"$table\" RESTART IDENTITY CASCADE;" || {
      echo "⚠️  Warning: could not TRUNCATE $table (maybe it doesn't exist yet?). Skipping."
      continue
    }

  # 3) Load data into STAGING
  psql "$STAGING_DB_URL" \
    -f "$DUMP_DIR/prod-$table.sql"

  # 4) Show row count for sanity
  psql "$STAGING_DB_URL" \
    -c "SELECT '$table' AS table, count(*) FROM \"$table\";"
done

echo "✅ Core data sync complete."