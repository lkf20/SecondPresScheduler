# Unified Time Off Requests API - Testing Guide

## Endpoint
`GET /api/time-off-requests`

## Query Parameters

### Filters
- `start_date` (ISO format): Filter requests that overlap with this date
- `end_date` (ISO format): Filter requests that overlap with this date  
- `status` (comma-separated): Filter by status (`active`, `draft`, `deleted`)
- `teacher_id`: Filter by specific teacher ID
- `classroom_id`: Filter by classroom (checks if any shift is in this classroom)
- `coverage_status` (comma-separated): Filter by coverage status (`needs_coverage`, `partially_covered`, `covered`)

### Options
- `include_detailed_shifts` (boolean, default: `false`): Include detailed shift information
- `include_classrooms` (boolean, default: `true`): Include classroom information
- `include_assignments` (boolean, default: `true`): Include assignment/sub information

## Response Format

```json
{
  "data": [
    {
      "id": "string",
      "teacher_id": "string",
      "teacher_name": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD | null",
      "reason": "string | null",
      "notes": "string | null",
      "classrooms": [
        {
          "id": "string",
          "name": "string",
          "color": "string | null"
        }
      ],
      "covered": 0,
      "partial": 0,
      "uncovered": 0,
      "total": 0,
      "status": "covered" | "partially_covered" | "needs_coverage",
      "shift_details": [
        {
          "label": "string",
          "status": "covered" | "partial" | "uncovered"
        }
      ]
    }
  ],
  "meta": {
    "total": 0,
    "filters": {
      "start_date": "string | null",
      "end_date": "string | null",
      "status": ["string"],
      "teacher_id": "string | null",
      "classroom_id": "string | null",
      "coverage_status": ["string"] | null
    }
  }
}
```

## Testing Examples

### 1. Get all active requests
```javascript
fetch('/api/time-off-requests?status=active')
  .then(r => r.json())
  .then(console.log)
```

### 2. Get requests in date range
```javascript
const today = new Date().toISOString().slice(0, 10)
const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
fetch(`/api/time-off-requests?status=active&start_date=${today}&end_date=${twoWeeksLater}`)
  .then(r => r.json())
  .then(console.log)
```

### 3. Get requests needing coverage
```javascript
fetch('/api/time-off-requests?status=active&coverage_status=needs_coverage')
  .then(r => r.json())
  .then(console.log)
```

### 4. Get requests with detailed shifts (for Sub Finder)
```javascript
fetch('/api/time-off-requests?status=active&include_detailed_shifts=true')
  .then(r => r.json())
  .then(console.log)
```

### 5. Combined filters
```javascript
fetch('/api/time-off-requests?status=active&start_date=2026-01-14&coverage_status=needs_coverage,partially_covered&include_detailed_shifts=false')
  .then(r => r.json())
  .then(console.log)
```

## Integration Status

✅ **Dashboard API** (`/api/dashboard/overview`)
- Refactored to use unified endpoint transformation logic
- Maintains backward compatibility
- Uses direct function calls (no HTTP overhead)

✅ **Sub Finder API** (`/api/sub-finder/absences`)
- Refactored to call unified endpoint via HTTP
- Uses `include_detailed_shifts=true` for detailed shift information
- Maintains existing response format

✅ **Time Off Page** (`/app/(dashboard)/time-off/page.tsx`)
- Already uses `transformTimeOffCardData` utility
- Consistent with unified approach
- No changes needed

## Verification

To verify the endpoint is working:

1. **Open the app in a browser** (http://localhost:3001)
2. **Log in** if not already authenticated
3. **Open browser console** (F12)
4. **Run test command**:
   ```javascript
   fetch('/api/time-off-requests?status=active')
     .then(r => r.json())
     .then(data => {
       console.log('✅ API Response:', data)
       console.log('📊 Total requests:', data.meta?.total || 0)
       console.log('📋 First request:', data.data?.[0])
     })
   ```

## Expected Behavior

- ✅ Returns JSON with `data` array and `meta` object
- ✅ Each item in `data` has all required fields
- ✅ Coverage counts (`covered`, `partial`, `uncovered`) are accurate
- ✅ Status values are correct (`covered`, `partially_covered`, `needs_coverage`)
- ✅ Filters work correctly
- ✅ Date range filtering works (overlap logic)
- ✅ Classroom filtering works
- ✅ Coverage status filtering works

## Notes

- The endpoint requires authentication (Supabase session)
- When accessed without authentication, it will redirect to login (returns HTML)
- All data transformation uses the shared `transformTimeOffCardData` utility
- The endpoint is ready for AI chat integration
