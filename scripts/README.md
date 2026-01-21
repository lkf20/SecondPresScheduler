# Test Scripts

## test-school-id-migration.sh

Tests the school_id migration to verify:
- All required tables have `school_id` columns
- `school_id` columns are NOT NULL
- Tables have data
- Default school_id is being used
- Unique constraints include school_id
- Profiles table has school_id

### Usage

```bash
# Using npm script
npm run test:migration

# Or directly
bash scripts/test-school-id-migration.sh
```

### Prerequisites

- Supabase CLI installed and configured
- Connected to your Supabase project (`supabase link`)
- Migrations 045 and 046 have been applied

### What it tests

1. **Column Existence**: Verifies `school_id` columns exist in:
   - classrooms
   - time_slots
   - class_groups
   - teacher_schedules
   - staffing_rules
   - schedule_cells
   - schedule_settings

2. **NOT NULL Constraint**: Ensures no NULL values in `school_id` columns

3. **Data Presence**: Checks that tables contain data

4. **Default School ID**: Verifies all rows use the default school_id (`00000000-0000-0000-0000-000000000001`)

5. **Unique Constraints**: Tests that unique constraints include `school_id`:
   - classrooms (name, school_id)
   - time_slots (code, school_id)
   - class_groups (name, school_id)

6. **Profiles Table**: Checks that profiles table has `school_id` column

### Expected Output

```
🧪 Testing school_id migration...

📋 Running database checks via Supabase SQL...

=== Test 1: Checking school_id columns exist ===
✓ classrooms has school_id column
✓ time_slots has school_id column
...

=== Test 2: Checking school_id columns are NOT NULL ===
✓ classrooms has no NULL school_id values
...

✅ Test script completed!
```

### Troubleshooting

If tests fail:
1. Ensure migrations 045 and 046 have been applied: `supabase db push`
2. Check that you're connected to the correct project: `supabase status`
3. Verify your database connection: `supabase db execute "SELECT 1"`
