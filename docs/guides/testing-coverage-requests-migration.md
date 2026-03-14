# Testing Coverage Requests Migration

## Overview

This document outlines how to test the coverage_requests migration and verify that all triggers, counters, and status updates are working correctly.

## Pre-Testing Checklist

1. ✅ Migration has been applied to the database
2. ✅ Unknown classroom was created
3. ✅ Existing time_off_requests were migrated to coverage_requests

## Testing Steps

### Step 1: Verify Migration Data

Run the test queries in `supabase/migrations/031_test_coverage_requests.sql` to verify:

- Unknown classroom exists
- Existing time_off_requests have coverage_request_id
- coverage_request_shifts were created correctly
- Counters match actual data

### Step 2: Test Creating New Time Off Request

**Via UI:**

1. Navigate to the Time Off page
2. Create a new time off request for a teacher
3. Select specific shifts or use "all scheduled" mode
4. Submit the request

**Verify:**

- A new `time_off_request` was created
- A corresponding `coverage_request` was created (check via SQL)
- `coverage_request_shifts` were created for each selected shift
- `total_shifts` counter matches the number of shifts
- `covered_shifts` counter starts at 0
- `status` is 'open'

**SQL Check:**

```sql
SELECT
  tor.id as time_off_request_id,
  cr.id as coverage_request_id,
  cr.total_shifts,
  cr.covered_shifts,
  cr.status,
  (SELECT COUNT(*) FROM coverage_request_shifts WHERE coverage_request_id = cr.id) as shift_count
FROM time_off_requests tor
JOIN coverage_requests cr ON tor.coverage_request_id = cr.id
WHERE tor.id = 'YOUR_NEW_REQUEST_ID';
```

### Step 3: Test Counter Updates (Adding Assignment)

**Action:**

1. Assign a sub to one of the shifts in the coverage request
2. Create a `sub_assignment` record

**Verify:**

- `covered_shifts` counter incremented by 1
- Status remains 'open' (if not all shifts covered)
- Status changes to 'filled' (if all shifts now covered)

**SQL Check:**

```sql
-- Before assignment
SELECT id, total_shifts, covered_shifts, status
FROM coverage_requests
WHERE id = 'YOUR_COVERAGE_REQUEST_ID';

-- Create assignment (via API or SQL)
INSERT INTO sub_assignments (sub_id, teacher_id, date, day_of_week_id, time_slot_id, assignment_type, classroom_id)
VALUES (...);

-- After assignment
SELECT id, total_shifts, covered_shifts, status
FROM coverage_requests
WHERE id = 'YOUR_COVERAGE_REQUEST_ID';
```

### Step 4: Test Counter Updates (Removing Assignment)

**Action:**

1. Delete a `sub_assignment` for a covered shift

**Verify:**

- `covered_shifts` counter decremented by 1
- Status changes from 'filled' to 'open' (if it was fully covered)

### Step 5: Test Counter Updates (Adding/Removing Shifts)

**Action:**

1. Edit the time off request and add a new shift
2. Edit the time off request and remove a shift

**Verify:**

- `total_shifts` counter updates correctly
- Status recomputes based on new totals

### Step 6: Shifts without scheduled classroom (GET coverage-request API)

**Behavior (current):** When GET `/api/sub-finder/coverage-request/[absence_id]` creates coverage_request_shifts, it **omits** any shift for which the teacher has no `teacher_schedules` row (same school) with a non-null `classroom_id`. It does **not** assign those shifts to "Unknown (needs review)". The response includes `omitted_shift_count` and `omitted_shifts` so the client can show that some shifts could not be added.

**Legacy:** Shifts that were previously assigned to "Unknown (needs review)" (e.g. by DB triggers or older API behavior) can still exist. You can query them for review:

**SQL Check (existing Unknown shifts only):**

```sql
SELECT
  crs.*,
  c.name as classroom_name,
  s.first_name || ' ' || s.last_name as teacher_name
FROM coverage_request_shifts crs
JOIN coverage_requests cr ON crs.coverage_request_id = cr.id
JOIN staff s ON cr.teacher_id = s.id
JOIN classrooms c ON crs.classroom_id = c.id
WHERE c.name = 'Unknown (needs review)';
```

### Step 7: Test Status Transitions

**Test Cases:**

1. **Open → Filled**: Assign subs to all shifts
2. **Filled → Open**: Remove an assignment
3. **Manual Cancellation**: Set status to 'cancelled' manually
   - Verify: Status stays 'cancelled' even if counters change

**SQL Check:**

```sql
-- Test manual cancellation
UPDATE coverage_requests
SET status = 'cancelled'
WHERE id = 'YOUR_COVERAGE_REQUEST_ID';

-- Try to trigger status update (should stay cancelled)
UPDATE coverage_requests
SET total_shifts = total_shifts + 1
WHERE id = 'YOUR_COVERAGE_REQUEST_ID';

-- Verify status is still 'cancelled'
SELECT status FROM coverage_requests WHERE id = 'YOUR_COVERAGE_REQUEST_ID';
```

### Step 8: Test Substitute Contacts (Future Feature)

Once the Contact Sub panel is implemented, test:

1. Creating a `substitute_contact` record
2. Updating contact status (should update timestamps)
3. Creating `sub_contact_shift_overrides`
4. Verifying cascade deletes work

## Expected Behaviors

### ✅ Counters Should Always Match Reality

- `total_shifts` = COUNT of `coverage_request_shifts` for that request
- `covered_shifts` = COUNT of shifts with matching `sub_assignments`

### ✅ Status Should Auto-Update

- `filled`: When `covered_shifts = total_shifts` AND `total_shifts > 0`
- `open`: When `covered_shifts < total_shifts` OR `total_shifts = 0`
- `cancelled`: Only set manually, never auto-updated

### ✅ Triggers Should Work in O(1) Time

- No queries needed to compute status
- Counters update immediately on INSERT/UPDATE/DELETE

### ✅ Unknown classroom and omitted shifts

- **GET coverage-request API:** Does not assign shifts to "Unknown (needs review)". Shifts without a scheduled classroom (same school) are **omitted**; the response includes `omitted_shift_count` and `omitted_shifts`.
- **Time off creation (API):** Rejects new time off when any shift has no scheduled classroom (see Time off classroom requirement in [docs/domain/data-lifecycle.md](../domain/data-lifecycle.md)).
- **Trigger (DB):** The trigger `auto_create_coverage_request_shift_from_time_off_shift` (migration 104) does **not** use "Unknown (needs review)". If classroom cannot be resolved from `teacher_schedules` (same school), the trigger **raises an exception** and the `time_off_shift` insert is rolled back. So direct inserts into `time_off_shifts` that bypass the API will also fail when the teacher has no scheduled classroom for that (day, slot).
- **Legacy:** Existing coverage_request_shifts with "Unknown (needs review)" may still exist (e.g. from older data). Those shifts should be flagged for review in the UI.

### Verifying the trigger (no Unknown fallback)

To verify that the trigger raises when classroom is missing (e.g. after applying migration 104):

1. Create a time off request (via API or SQL) that has a linked coverage_request_id.
2. Attempt to insert a row into `time_off_shifts` for a (day_of_week_id, time_slot_id) where the teacher has **no** `teacher_schedules` row with a non-null `classroom_id` in that school.
3. The INSERT should fail with an error like: `Cannot create coverage shift: teacher has no scheduled classroom for this day/slot in this school...`

In normal use the API prevents such inserts (validation runs first), so the trigger acts as a backstop.

## Troubleshooting

### Issue: Counters don't match actual data

**Solution:** Run the counter accuracy query from the test script. If mismatched, you may need to recalculate:

```sql
UPDATE coverage_requests cr
SET
  total_shifts = (SELECT COUNT(*) FROM coverage_request_shifts WHERE coverage_request_id = cr.id),
  covered_shifts = (
    SELECT COUNT(DISTINCT crs.id)
    FROM coverage_request_shifts crs
    INNER JOIN sub_assignments sa ON
      sa.date = crs.date
      AND sa.time_slot_id = crs.time_slot_id
      AND sa.teacher_id = cr.teacher_id
    WHERE crs.coverage_request_id = cr.id
  );
```

### Issue: Status not updating

**Solution:** Check that triggers are enabled:

```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('coverage_requests', 'coverage_request_shifts', 'sub_assignments');
```

### Issue: Unknown classroom not created

**Solution:** Manually create it:

```sql
INSERT INTO classrooms (id, name, capacity, is_active, "order", created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'Unknown (needs review)',
  NULL,
  true,
  -1,
  NOW(),
  NOW()
);
```

## Next Steps After Testing

1. ✅ Verify all test cases pass
2. ✅ Update API code to use `coverage_requests` (optional, backward compatible)
3. ✅ Implement Contact Sub panel UI
4. ✅ Test end-to-end workflow with real data
