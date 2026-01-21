# Comparison: Deleted vs New Dashboard Overview Route

## Summary

The dashboard overview route was deleted in commit `b024de5` (Jan 21, 2026) but has been recreated with a new implementation that uses the modern `coverage_requests` schema instead of the legacy `time_off_requests` schema.

## Key Differences

### 1. **Data Source Architecture**

**Deleted Version (708 lines):**
- Used `time_off_requests` and `time_off_shifts` tables (legacy schema)
- Called `getTimeOffRequests()` and `getTimeOffShifts()` from `lib/api/time-off`
- Used `transformTimeOffCardData()` utility function
- More complex transformation logic with multiple helper functions

**New Version (405 lines):**
- Uses `coverage_requests` and `coverage_request_shifts` tables (modern schema)
- Direct Supabase queries
- Simpler, more direct data processing
- ~43% fewer lines of code

### 2. **Data Fetching Approach**

**Deleted Version:**
```typescript
// Used library functions with timeout protection
const { getTimeOffRequests } = await import('@/lib/api/time-off')
const { getTimeOffShifts } = await import('@/lib/api/time-off-shifts')
const { transformTimeOffCardData } = await import('@/lib/utils/time-off-card-data')

// Had timeout protection
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Timeout')), 10000)
)
timeOffRequests = await Promise.race([...])
```

**New Version:**
```typescript
// Direct Supabase queries
const { data: coverageRequests } = await supabase
  .from('coverage_requests')
  .select(...)
  .eq('school_id', schoolId)
```

### 3. **Classroom Resolution**

**Deleted Version:**
- Built complex classroom lookup maps from teacher schedules
- Used `classroomIdMap` and `classroomMap` with keys like `${teacher_id}|${day_of_week_id}|${time_slot_id}`
- Had fallback logic for "Classroom unavailable"

**New Version:**
- Gets classrooms directly from `coverage_request_shifts.classroom_id`
- Simpler, more direct approach
- No need for complex lookup maps

### 4. **Coverage Calculation**

**Deleted Version:**
- Used `transformTimeOffCardData()` utility
- Built assignment maps with `hasFull` and `hasPartial` flags
- More complex coverage status calculation

**New Version:**
- Directly matches `sub_assignments` to `coverage_request_shifts` via `coverage_request_shift_id`
- Simpler coverage counting logic
- More accurate (uses foreign key relationship)

### 5. **Staffing Targets**

**Deleted Version:**
- Used `schedule_cells` with complex enrollment and ratio calculations
- Built `absenceSlotKeys` to exclude slots with absences
- Complex date range calculations with `datesByDayId` map
- Checked `subAssignmentCountByDateSlot` for coverage

**New Version:**
- Uses `staffing_rules` table directly
- Simpler calculation based on `required_teachers` and `preferred_teachers`
- Counts scheduled staff from `teacher_schedules` and `sub_assignments`
- Less complex but may miss some edge cases

### 6. **Error Handling & Logging**

**Deleted Version:**
- Extensive console logging with `[Dashboard API]` prefix
- Timeout protection for slow queries
- More detailed error messages

**New Version:**
- Minimal logging
- No timeout protection
- Simpler error handling

### 7. **Response Format**

**Deleted Version:**
- Included `range: { start_date, end_date }` in response
- Used `transformTimeOffCardData()` which may have added extra fields

**New Version:**
- No `range` field (but dates are in query params)
- Direct mapping to expected format
- Cleaner response structure

## Advantages of New Version

1. ✅ **Uses modern schema** - Aligned with current codebase architecture
2. ✅ **Simpler code** - 43% fewer lines, easier to maintain
3. ✅ **More accurate** - Uses foreign key relationships (`coverage_request_shift_id`)
4. ✅ **Better performance** - Direct queries instead of multiple function calls
5. ✅ **No legacy dependencies** - Doesn't rely on `time_off_requests` utilities

## Potential Issues with New Version

1. ⚠️ **Less sophisticated staffing calculation** - May miss some edge cases
2. ⚠️ **No timeout protection** - Could hang on slow queries
3. ⚠️ **Less logging** - Harder to debug issues
4. ⚠️ **Missing `range` field** - Frontend may expect this (needs verification)

## Recommendations

1. **Keep the new implementation** - It's aligned with the modern schema
2. **Add timeout protection** - Consider adding back timeout logic for slow queries
3. **Add more logging** - For debugging production issues
4. **Verify frontend compatibility** - Check if dashboard page expects `range` field
5. **Test staffing targets** - Ensure the simpler calculation covers all cases
