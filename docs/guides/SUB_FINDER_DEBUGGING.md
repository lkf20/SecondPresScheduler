# Sub Finder debugging guide

Use this when "Mark as Declined" (or other contact updates) don’t seem to persist or the app doesn’t refresh.

## 1. Server-side debug logging

Run the app with Sub Finder debug logging so the API logs each contact update:

```bash
SUB_FINDER_DEBUG=true npm run dev
```

Then:

1. Open Sub Finder, select an absence, open a sub’s contact panel.
2. Click **Mark as Declined**.
3. In the terminal where `npm run dev` is running, look for:
   - `[sub-finder/substitute-contacts] PUT` — request (id, contact_status, response_status).
   - `[sub-finder/substitute-contacts] PUT result` — row after update.

If you don’t see these, the PUT request may not be reaching the server (e.g. client error or wrong URL). If you see them, check that `response_status` and `contact_status` in the result are `declined_all`.

## 2. Check the database

In the **Supabase Dashboard → SQL Editor**, run:

```sql
-- Replace with your sub's id if different
SELECT id, coverage_request_id, sub_id, response_status, contact_status, is_contacted, updated_at
FROM substitute_contacts
WHERE sub_id = 'c0b7733a-e770-45c5-bf17-bd20ce132e77'
ORDER BY updated_at DESC;
```

- **No rows**: no contact record for this sub; "Mark as Declined" should create one via GET then update via PUT. Check server logs for errors.
- **Rows exist but `response_status` / `contact_status` not `declined_all`**: update isn’t persisting. Check RLS policies and server logs.
- **Rows show `declined_all`**: DB is correct; the issue is likely the find-subs refetch or UI (e.g. `onAssignmentComplete` not running or find-subs not re-running for the selected absence).

## 3. Client / network

In the browser **DevTools → Network** tab:

1. Filter by "substitute-contacts" or "sub-finder".
2. Mark a sub as declined.
3. Confirm a **PUT** to `/api/sub-finder/substitute-contacts` with status **200** and a JSON body that includes `response_status: "declined_all"`.

If the PUT is 4xx/5xx, use the response body and server logs to fix the API or permissions.
