# Sub assignment integrity: server and DB rules

## Current behavior

### 1. Sub in multiple classrooms same date/slot (unless floater)

**Server (API):** Yes. In `POST /api/sub-finder/assign-shifts` we:

- Load the sub’s active assignments for the selected dates/slots (`subScheduleCollisions`).
- If any selected shift overlaps (same date + time_slot_id) and does **not** have a resolution (`floater` or `move`), we return **409** with:  
  `"Double booking prevented: this sub already has an active assignment for one or more selected shifts."`
- So assigning a sub to a second room in the same slot is blocked unless the request includes a resolution (floater or move).

**DB:** No. There is **no** unique constraint on `sub_assignments` for `(sub_id, date, time_slot_id)`. So:

- The only enforcement is in the assign-shifts API.
- Any other code path or direct DB insert could create a non-floater double booking.

### 2. Multiple subs for the same person/classroom/timeslot

**Server (API):** Partially.

- We treat shifts that already have an active assignment as “blocked” and normally return 409 unless the request has resolution `floater` or `move`.
- When assigning with resolution move/floater we **replace** the current sub: we cancel existing active `sub_assignments` for those `coverage_request_shift_id`s, then insert the new one(s). So in normal use we never create a second active sub for the same shift.

**DB:** No. There is **no** unique constraint on `sub_assignments` for “one active row per coverage_request_shift_id”. So:

- If the cancel-before-insert logic is skipped or another path inserts a row, the DB would allow multiple active subs for the same shift.
- That’s how the “three subs for one slot” bug was possible before we added the replace step.

## Recommendation

Add **DB-level** constraints so that:

1. **One active sub per shift**  
   At most one active `sub_assignment` per `coverage_request_shift_id`.

2. **Sub in at most one “full” assignment per date/slot**  
   At most one active, non-floater assignment per `(sub_id, date, time_slot_id)`.  
   Multiple active rows for the same `(sub_id, date, time_slot_id)` are allowed only when `is_floater = true` (floater in two rooms).

Migration `114_sub_assignments_unique_active.sql` (1) cleans existing duplicate active rows so that each coverage_request_shift has at most one active assignment and each (sub_id, date, time_slot_id) has at most one active non-floater assignment, then (2) adds two partial unique indexes so the DB enforces the same rules going forward. The assign-shifts API already cancels existing assignments for the shift before inserting (replace behavior), so API and DB stay aligned.
