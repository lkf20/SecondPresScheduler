# Audit Log Contract

**Use this contract whenever you add or change audit logging.** The validator in `lib/audit/validateAuditLog.ts` and its tests enforce these rules so that generic or incomplete logs do not slip through.

## Purpose

Every audit log entry must allow a reader to answer:

| Question                          | Where it comes from                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Who** did it                    | `actor_user_id` + `actor_display_name` (required for user-initiated actions)                                              |
| **What** they did                 | `action` + `category` + `entity_type`                                                                                     |
| **To what** (which record/entity) | `entity_id` + `details` (IDs and **human-readable names** of the thing affected)                                          |
| **When**                          | `created_at` (set by DB)                                                                                                  |
| **What changed**                  | `details`: before/after, added/removed, or explicit list of changed fields and values                                     |
| **Context**                       | `details`: enough info to understand scope (e.g. classroom name, day, time slot, staff name) without joining other tables |

If an entry cannot answer these, it fails the contract.

---

## Scope: what to include in the Activity Feed / audit log

The audit log (and thus the Activity Feed) must include:

- **Time off** — All new time off requests and all changes (status changes, cancellations).
- **Sub assignments** — All new sub assignments and all unassignments (who was assigned to which shifts).
- **Baseline staffing** — All changes to baseline schedule: schedule cells (create, update, delete) and teacher assignments (assign, unassign, update), including conflict resolution.
- **Temporary coverage** — All new temporary coverage assignments and all removals/cancellations (full or partial).
- **Settings** — All new entries or changes to:
  - Staff (create, update, deactivate).
  - Classrooms (create, update).
  - Class groups (create, update, delete).
  - Days of week and time slots (create, update, delete).
  - School calendar: first/last day of school (update); school closures (create, update, delete).
- **Coverage** — Coverage request lifecycle (create, status change, cancel) where not already covered by time off or sub assignments.
- **Other** — Any other user-initiated change that affects scheduling, coverage, or the above settings should be considered for audit logging so the Activity Feed remains a reliable record of what changed and by whom.

---

## Required Data (top-level)

Every log entry must include:

| Field                | Required           | Notes                                                                                                                                         |
| -------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `school_id`          | Yes                | Scope; never null.                                                                                                                            |
| `action`             | Yes                | One of: `create`, `update`, `delete`, `status_change`, `assign`, `unassign`, `cancel`.                                                        |
| `category`           | Yes                | One of: `time_off`, `sub_assignment`, `baseline_schedule`, `temporary_coverage`, `staff`, `coverage`, `school_calendar`, `system`, `unknown`. |
| `entity_type`        | Yes                | e.g. `schedule_cell`, `teacher_schedule`, `time_off_request`, `coverage_request`.                                                             |
| `entity_id`          | When applicable    | ID of the primary entity (null for some bulk or cancel-only logs).                                                                            |
| `actor_user_id`      | Preferred          | Who did it; null only for system actions.                                                                                                     |
| `actor_display_name` | Preferred          | Human-readable "who"; should be set whenever actor_user_id is set.                                                                            |
| `details`            | Yes for non-system | Must not be empty for `assign`, `unassign`, `update`, `delete`, `create`. See "Metadata by action" and "Quality rules".                       |

---

## Metadata Required by Action

`details` must include the following **by action** (and category where it matters). IDs alone are not enough: include **human-readable names** so the Activity feed and support can show "what" without DB lookups.

### `baseline_schedule` + `schedule_cell`

| Action   | Required in `details`                                                                                                           | Human-readable required                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `create` | `classroom_id`, `day_of_week_id`, `time_slot_id`, `is_active`; optionally `class_group_ids`, `enrollment_for_staffing`, `notes` | `classroom_name`, `day_name`, `time_slot_code`                                              |
| `update` | Same as create; for bulk: `cell_count`, `bulk: true`, and at least one of classroom/day/slot scope                              | Same names; for bulk a short summary (e.g. "3 cells in Toddler A, Monday AM") is acceptable |
| `delete` | `classroom_id`, `day_of_week_id`, `time_slot_id`, `is_active: false`                                                            | `classroom_name`, `day_name`, `time_slot_code`                                              |

### `baseline_schedule` + `teacher_schedule`

| Action             | Required in `details`                                                        | Human-readable required                                        |
| ------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `assign`           | `teacher_id`, `classroom_id`, `day_of_week_id`, `time_slot_id`, `is_floater` | `teacher_name`, `classroom_name`, `day_name`, `time_slot_code` |
| `unassign`         | Same IDs as assign                                                           | `teacher_name`, `classroom_name`, `day_name`, `time_slot_code` |
| `update`           | `teacher_id`, same IDs, `updated_fields` (list of keys changed)              | `teacher_name`, `classroom_name`, `day_name`, `time_slot_code` |
| (resolve-conflict) | `reason`, before/after or added/removed context                              | `teacher_name`, classroom/day/slot names where applicable      |

### `time_off` + `time_off_request`

| Action                     | Required in `details`                                                                            | Human-readable required |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------- |
| `create`                   | `teacher_id`, `start_date`, `end_date`, `status`; optionally `shifts_created`, `shifts_excluded` | `teacher_name`          |
| `cancel`                   | `teacher_id`                                                                                     | `teacher_name`          |
| `status_change` / `update` | `teacher_id`, `before`/`after` or changed fields                                                 | `teacher_name`          |

### `sub_assignment` / `coverage`

| Action     | Required in `details`                                  | Human-readable required                                                       |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `assign`   | `teacher_id` or `sub_id`, assignment/shift identifiers | `teacher_name` and/or sub name; enough to describe "who was assigned to what" |
| `unassign` | Same as assign                                         | Same names                                                                    |

### `temporary_coverage` + `staffing_event`

| Action   | Required in `details`                                                           | Human-readable required                       |
| -------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| `assign` | `staff_id`, `start_date`, `end_date`, `shift_count`; optionally `classroom_ids` | `teacher_name`, `classroom_name` (or summary) |
| `cancel` | `staff_id`, `scope`, `removed_count`, `remaining_active_shifts`                 | `teacher_name`                                |

### `school_calendar` + `calendar_settings`

| Action   | Required in `details`                                                             | Human-readable required                      |
| -------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| `update` | `updated_fields` (e.g. `first_day_of_school`, `last_day_of_school`), before/after | `summary` (e.g. "First day: …, Last day: …") |

### `school_calendar` + `school_closure`

| Action   | Required in `details`                                                               | Human-readable required                                                      |
| -------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `create` | `date`, `time_slot_id` or `whole_day`; optionally `reason`, `start_date`/`end_date` | `summary` or `date` + `reason` (e.g. "2025-03-15 (whole day): Thanksgiving") |
| `delete` | `date`, `time_slot_id` or `whole_day`; optionally `reason`                          | `summary` or `date` + `reason`                                               |

---

## Quality Rules

1. **No generic "update"**  
   For `action: 'update'`, `details` must include either:
   - `updated_fields` (list of keys), and/or
   - before/after or added/removed values for the change.  
     An entry with only IDs and no indication of what changed is invalid.

2. **Human-readable names**  
   Whenever the entity or context involves a **person** (staff, teacher, sub) or **place/slot** (classroom, day, time slot), `details` must include at least one corresponding name field (e.g. `teacher_name`, `classroom_name`, `day_name`, `time_slot_code`) so the log is readable without DB lookups.

3. **No empty or trivial details**  
   For actions `create`, `update`, `delete`, `assign`, `unassign`, `details` must be present and non-empty. It must not be only `{}` or only IDs with no names or change description.

4. **Consistent entity_type**  
   `entity_type` must match the primary entity being acted on (e.g. `teacher_schedule` for teacher assignment changes, `schedule_cell` for cell changes).

5. **Bulk operations**  
   For bulk updates, `details` must include `cell_count` (or equivalent) and enough context (e.g. classroom/day/slot scope or summary) to understand what was updated.

---

## Gold Examples (good logs)

### Example 1: Baseline – assign teacher (specific, readable)

```json
{
  "school_id": "school-uuid",
  "actor_user_id": "user-uuid",
  "actor_display_name": "Jane Admin",
  "action": "assign",
  "category": "baseline_schedule",
  "entity_type": "teacher_schedule",
  "entity_id": "schedule-uuid",
  "details": {
    "teacher_id": "staff-uuid",
    "teacher_name": "Maria Garcia",
    "classroom_id": "classroom-uuid",
    "classroom_name": "Toddler A",
    "day_of_week_id": "day-uuid",
    "day_name": "Monday",
    "time_slot_id": "slot-uuid",
    "time_slot_code": "AM",
    "is_floater": false
  }
}
```

**Why it's good:** Who (Jane Admin), what (assign), to what (teacher_schedule; Maria Garcia → Toddler A, Monday AM), when (created_at), what changed (assignment added), context (names so no DB needed).

### Example 2: Time off – create (with teacher name and scope)

```json
{
  "school_id": "school-uuid",
  "actor_user_id": "user-uuid",
  "actor_display_name": "Jane Admin",
  "action": "create",
  "category": "time_off",
  "entity_type": "time_off_request",
  "entity_id": "request-uuid",
  "details": {
    "teacher_id": "staff-uuid",
    "teacher_name": "John Smith",
    "status": "approved",
    "start_date": "2025-03-01",
    "end_date": "2025-03-05",
    "shifts_created": 4,
    "shifts_excluded": 0
  }
}
```

**Why it's good:** Who, what, to what (time off for John Smith), what changed (request created with dates and shift count), context (teacher name and scope).

### Example 3: Baseline – bulk update schedule cells (summary)

```json
{
  "school_id": "school-uuid",
  "actor_user_id": "user-uuid",
  "actor_display_name": "Jane Admin",
  "action": "update",
  "category": "baseline_schedule",
  "entity_type": "schedule_cell",
  "entity_id": "first-cell-uuid",
  "details": {
    "cell_count": 3,
    "bulk": true,
    "classroom_ids": ["c1"],
    "classroom_name": "Toddler A",
    "day_of_week_ids": ["d1"],
    "day_name": "Monday",
    "time_slot_ids": ["s1", "s2"],
    "time_slot_codes": "AM, PM",
    "summary": "3 cells in Toddler A, Monday (AM, PM)"
  }
}
```

**Why it's good:** Who, what (bulk update), to what (3 cells), scope (classroom + day + slots), and a short human-readable summary.

### Example 4: Temporary coverage – assign

```json
{
  "school_id": "school-uuid",
  "actor_user_id": "user-uuid",
  "actor_display_name": "Jane Admin",
  "action": "assign",
  "category": "temporary_coverage",
  "entity_type": "staffing_event",
  "entity_id": "event-uuid",
  "details": {
    "staff_id": "staff-uuid",
    "teacher_name": "Maria Garcia",
    "classroom_ids": ["classroom-uuid"],
    "classroom_name": "Toddler A",
    "start_date": "2025-03-01",
    "end_date": "2025-03-07",
    "shift_count": 12
  }
}
```

**Why it's good:** Who, what (assign temporary coverage), to what (staffing_event; Maria Garcia → Toddler A), when (created_at), what changed (assignment created with date range and shift count), context (teacher and classroom names).

### Example 5: School calendar – update first/last day of school

```json
{
  "school_id": "school-uuid",
  "actor_user_id": "user-uuid",
  "actor_display_name": "Jane Admin",
  "action": "update",
  "category": "school_calendar",
  "entity_type": "calendar_settings",
  "entity_id": null,
  "details": {
    "updated_fields": ["first_day_of_school", "last_day_of_school"],
    "before": { "first_day_of_school": "2024-08-01", "last_day_of_school": "2025-06-15" },
    "after": { "first_day_of_school": "2025-08-01", "last_day_of_school": "2026-06-15" },
    "summary": "First day: 2025-08-01, Last day: 2026-06-15"
  }
}
```

**Why it's good:** Who, what (update calendar settings), what changed (before/after and updated_fields), context (summary of new dates).

### Example 6: School calendar – create closure

```json
{
  "school_id": "school-uuid",
  "actor_user_id": "user-uuid",
  "actor_display_name": "Jane Admin",
  "action": "create",
  "category": "school_calendar",
  "entity_type": "school_closure",
  "entity_id": "closure-uuid",
  "details": {
    "date": "2025-11-28",
    "time_slot_id": null,
    "reason": "Thanksgiving",
    "whole_day": true,
    "summary": "2025-11-28 (whole day): Thanksgiving"
  }
}
```

**Why it's good:** Who, what (create closure), to what (date + reason), context (summary readable without DB).

---

## Bad Examples (invalid or low-quality logs)

### Bad Example 1: Generic update with only IDs (fails contract)

```json
{
  "school_id": "school-uuid",
  "actor_user_id": "user-uuid",
  "actor_display_name": "Jane Admin",
  "action": "update",
  "category": "baseline_schedule",
  "entity_type": "teacher_schedule",
  "entity_id": "schedule-uuid",
  "details": {
    "teacher_id": "staff-uuid",
    "classroom_id": "classroom-uuid",
    "day_of_week_id": "day-uuid",
    "time_slot_id": "slot-uuid"
  }
}
```

**Why it's bad:**

- No human-readable names (teacher_name, classroom_name, day_name, time_slot_code).
- No indication of **what changed** (no `updated_fields`, no before/after).  
  A reader cannot answer "what did they do?" or "to what?" without looking up IDs.

### Bad Example 2: Empty details (fails contract)

```json
{
  "school_id": "school-uuid",
  "actor_user_id": "user-uuid",
  "action": "assign",
  "category": "baseline_schedule",
  "entity_type": "teacher_schedule",
  "entity_id": "schedule-uuid",
  "details": {}
}
```

**Why it's bad:**  
For `assign`, `details` must be non-empty and include who was assigned and to what (IDs + names). Empty details make the log useless for "what they did" and "to what".

---

## Validator and Tests

- **Validator:** `lib/audit/validateAuditLog.ts`
  - Input: same shape as the object passed to `logAuditEvent` (see `AuditLogEntryInput`).
  - Output: `{ valid: boolean, errors: string[] }`.
  - It checks: required top-level fields, required and human-readable fields in `details` by `category` + `action` + `entity_type`, and the quality rules above.

- **Tests:** `lib/audit/__tests__/validateAuditLog.test.ts`
  - Gold examples from this contract must **pass** validation.
  - Bad examples must **fail** with expected error messages.
  - A "generic" log (e.g. update with only IDs, no names, no updated_fields) must fail.
  - Ensures no generic or incomplete log slips through as the codebase evolves.

**How to use when adding or changing audit logs:**

1. Build the payload you will pass to `logAuditEvent`.
2. Call `validateAuditLogEntry(payload)` (e.g. in dev or in a test).
3. If `valid` is false, fix `errors` (add names, updated_fields, etc.).
4. Add a gold example to this doc and to the test file for new action/category/entity combinations.

When adding a new audit log call site or a new action/category, add an example to this contract and to the validator tests so the contract stays enforced.
