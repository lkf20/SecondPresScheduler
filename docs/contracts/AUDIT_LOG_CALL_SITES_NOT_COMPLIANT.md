# Audit Log Call Sites – Compliance Status

**All listed call sites have been updated to satisfy the [AUDIT_LOG_CONTRACT.md](./AUDIT_LOG_CONTRACT.md).**

Previously non-compliant call sites were updated to include human-readable names (e.g. `teacher_name`, `classroom_name`, `day_name`, `time_slot_code`, `summary`) and, where required, explicit “what changed” (e.g. `updated_fields`, before/after, or bulk `cell_count`/`summary`).

## Baseline Schedule (fixed)

- **schedule-cells** – POST create, PUT update, DELETE, PUT bulk: now include `classroom_name`, `day_name`, `time_slot_code` (and for bulk, `summary`); update includes `updated_fields`.
- **teacher-schedules** – POST assign, PUT update, DELETE: now include `teacher_name`, `classroom_name`, `day_name`, `time_slot_code`.
- **resolve-conflict** – All 5 `createTeacherScheduleAuditLog` calls: now pass `teacher_name`, classroom/day/slot names via extended `createTeacherScheduleAuditLog` and fetches in the route.

## Sub-finder / Coverage (fixed)

- **assign-shifts** – Main assign and director-override logs: now include `teacher_name` and `sub_name`.
- **unassign-shifts** – Now includes `teacher_name` and `sub_name`.

---

When adding new audit log call sites, ensure they satisfy the contract and pass `validateAuditLogEntry`. If you discover a call site that no longer complies (e.g. after a refactor), add it to this file with “What’s missing” and fix it.
