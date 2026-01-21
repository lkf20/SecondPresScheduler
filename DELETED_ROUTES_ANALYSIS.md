# Analysis of Deleted API Routes

## Routes Deleted in Commit `b024de5`

The following routes were deleted in the commit that renamed the Supabase environment variable:

1. ✅ **`/api/dashboard/overview/route.ts`** - **RESTORED** (new implementation using `coverage_requests`)
2. ❌ **`/api/dashboard/coverage-summary/route.ts`** - **NOT REFERENCED** (safe to leave deleted)
3. ⚠️ **`/api/setup/profile/route.ts`** - **NEEDS RESTORATION** (actively used)
4. ⚠️ **`/api/time-off-requests/route.ts`** - **NEEDS RESTORATION** (actively used)

## Route Status

### 1. `/api/dashboard/overview` ✅ RESTORED

**Status:** Already recreated with new implementation
**References:** 
- `app/(dashboard)/dashboard/page.tsx` - Uses this endpoint
- `lib/hooks/use-dashboard.ts` - Uses this endpoint

**Decision:** Keep the new implementation using `coverage_requests` schema

---

### 2. `/api/dashboard/coverage-summary` ❌ NOT NEEDED

**Status:** Not referenced anywhere in codebase
**References:** None found

**Decision:** Safe to leave deleted - likely replaced by `/api/dashboard/overview`

---

### 3. `/api/setup/profile` ⚠️ NEEDS RESTORATION

**Status:** **CRITICAL** - Actively used by multiple components
**References:**
- `app/(dashboard)/setup/profile/page.tsx` - Line 29, 65 (GET and POST requests)
- `lib/hooks/use-profile.ts` - Line 17 (GET request)

**Impact:** 
- Profile setup page will fail without this route
- Profile checking functionality will break

**Action Required:** Restore from commit `ae31a5d` or earlier

---

### 4. `/api/time-off-requests` ⚠️ NEEDS RESTORATION

**Status:** **CRITICAL** - Actively used by React Query hook
**References:**
- `lib/hooks/use-time-off-requests.ts` - Line 47 (GET request)
- `UNIFIED_API_TESTING.md` - Documentation references this endpoint
- `TODO_TRACKER.md` - Mentions this endpoint

**Impact:**
- Time off requests functionality will fail
- Any component using `useTimeOffRequests()` hook will break

**Note:** There's also `/api/time-off/route.ts` which might be an alternative, but the hook specifically calls `/api/time-off-requests`

**Action Required:** Restore from commit `67ff617` (where it was created) or check if `/api/time-off` can be used instead

---

## Recommended Actions

1. ✅ **Dashboard Overview** - Already restored, keep new implementation
2. ❌ **Coverage Summary** - Leave deleted (not needed)
3. 🔴 **Setup Profile** - **RESTORE IMMEDIATELY** - Critical for user onboarding
4. 🔴 **Time Off Requests** - **RESTORE IMMEDIATELY** - Critical for time off functionality

## Next Steps

1. Restore `/api/setup/profile/route.ts` from git history
2. Restore `/api/time-off-requests/route.ts` from git history OR refactor `use-time-off-requests.ts` to use `/api/time-off` instead
3. Test all restored routes to ensure they work with current schema
