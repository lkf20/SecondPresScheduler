# Database Schema Summary

## Overview

The database schema has evolved from the initial 17 tables (migration 001) to the current set of tables below. All tables are in the `public` schema and are created or altered by migrations in `supabase/migrations/` (001 through current, including 118).

## Tables (current)

### Core Reference Tables (4)

1. **classrooms** - Physical room locations with capacity, optional notes, color, order, and `is_active`
2. **class_groups** - Logical class names with parent-child relationships, age/ratio fields, care requirements, optional notes (the former **classes** table was removed in migrations 054/058)
3. **time_slots** - Time periods (e.g. EM, AM, LB, AC) with default start/end times, display order, and `is_active`
4. **days_of_week** - Days of the week (Monday–Friday)

### Schools & Multi-tenancy (2)

5. **schools** - Schools/tenants
6. **profiles** - Links auth.users to schools with roles (e.g. director); includes display name and theme

### People & Roles (5)

7. **staff** - All staff members (first_name, last_name, display_name, email, phone, `is_sub`, etc.). Teacher role is indicated via **staff_role_type_assignments** to PERMANENT/FLEXIBLE; `is_teacher` is deprecated.
8. **staff_role_types** - Role type definitions (e.g. PERMANENT, FLEXIBLE)
9. **staff_role_type_assignments** - Staff ↔ staff_role_type (many-to-many)
10. **qualification_definitions** - Qualification types (e.g. Infant qualified, CPR certified)
11. **staff_qualifications** - Staff ↔ qualifications with level, expiration, verification

### Schedule Tables – Baseline (4)

12. **schedule_settings** - Per-school settings: first/last day of school, time zone, report defaults (daily schedule, sub availability), etc.
13. **schedule_cells** - Baseline schedule cells (classroom × day × timeslot); enrollment and required/preferred staff overrides live here and in **schedule_cell_class_groups**
14. **schedule_cell_class_groups** - Join table: which class groups are in a cell; supports per-class enrollment
15. **classroom_allowed_classes** - Which class groups are allowed in which classrooms (replaces the former class–classroom mapping concept; **class_classroom_mappings** was removed in migration 070)

### Schedule Tables – Teacher Baseline & Availability (4)

16. **teacher_schedules** - Baseline Permanent and Baseline Flex weekly schedules (teacher × day × slot × class_group × classroom, optional floater)
17. **sub_availability** - General sub availability by day/timeslot
18. **sub_availability_exceptions** - One-off availability exceptions by date (optional link to **sub_availability_exception_headers**)
19. **sub_availability_exception_headers** - Date-range availability exception headers

### Preference Tables (1)

20. **sub_class_preferences** - Which class groups subs can/cannot teach

(Former table **classroom_preferences** was removed in migration 071. Former **staffing_rules** and **enrollments** were removed in migrations 069 and 106.)

### Time Off & Coverage (4)

21. **time_off_requests** - Teacher time off requests (reason, status, notes; link to **coverage_requests**)
22. **time_off_shifts** - Individual shifts per time off request; trigger (migration 104) creates **coverage_request_shifts** on INSERT and raises if teacher has no scheduled classroom for that day/slot
23. **coverage_requests** - Coverage abstraction (time_off, manual_coverage, emergency) with counters
24. **coverage_request_shifts** - Individual shifts needing coverage (date, slot, classroom_id, class_group_id)

### Substitute Contact & Assignment (4)

25. **substitute_contacts** - Per-coverage-request contact status (sub × coverage_request; status, notes, timestamps)
26. **sub_contact_shift_overrides** - Per-shift overrides for substitute_contacts (e.g. override_availability)
27. **sub_assignments** - Actual sub assignments (master calendar: sub × date × slot × classroom). Key columns: `is_partial NOT NULL DEFAULT false`, `partial_start_time`, `partial_end_time`, optional `staffing_event_shift_id` (links reassignment-backed coverage rows). A conditional unique index `idx_sub_assignments_one_active_full_per_shift` prevents two active full assignments for the same `coverage_request_shift_id`. Multiple active partial assignments (up to 4) are allowed per shift.

(Former **sub_contact_overrides** and **sub_contact_log** were removed in migrations 073 and 072.)

### Temporary Coverage (2)

28. **staffing_events** - Grouping for Temporary Coverage (flex) assignments
29. **staffing_event_shifts** - Individual shift records for Temporary Coverage and day-only reassignment (`source_classroom_id`, optional `coverage_request_shift_id`)

### Calendar & Audit (2)

30. **school_closures** - Closed days or slots (school_id, date, optional time_slot_id, reason, notes). `time_slot_id` NULL = whole day closed.
31. **audit_log** - Activity log for audit trail

## Key Features

- **UUID Primary Keys** - All tables use UUID for unique identification
- **Foreign Key Constraints** - Ensures referential integrity
- **Unique Constraints** - Prevents duplicate data where appropriate
- **Automatic Timestamps** - `created_at` and `updated_at` managed automatically where applicable
- **Triggers** - Auto-update `updated_at` on row updates; `auto_create_coverage_request_shift_from_time_off_shift` (migration 104) creates a `coverage_request_shift` on INSERT into `time_off_shifts` and **raises** if the teacher has no scheduled classroom for that day/slot (no "Unknown" fallback). The "Unknown (needs review)" classroom placeholder was removed in migration 105. `update_coverage_request_covered_shifts` (rewritten in migration 117) maintains `covered_shifts` and `status` on `coverage_requests` in a status-transition-aware and count-aware way (increments on first active assignment per shift; decrements when last active assignment is removed).
- **Indexes** - Performance indexes on frequently queried columns
- **Row Level Security** - RLS policies for data access control (school-scoped where applicable)

## Tables that reference classrooms (classroom_id)

When writing queries that find or count rows by classroom (e.g. for cleanup or reporting), use only tables that have a `classroom_id` column. As of the current schema:

- **teacher_schedules** (classroom_id)
- **classroom_allowed_classes** (classroom_id)
- **sub_assignments** (classroom_id)
- **schedule_cells** (classroom_id)
- **coverage_request_shifts** (classroom_id)
- **staffing_event_shifts** (classroom_id)

**classroom_preferences**, **class_classroom_mappings**, **teacher_schedule_audit_log**, and **enrollments** have been removed (migrations 071, 070, 068, 106).

## Relationships

- Staff have roles (e.g. PERMANENT, FLEXIBLE) via **staff_role_type_assignments**; `is_teacher` is deprecated. Subs are indicated via the `is_sub` flag.
- Temporary Coverage is handled via **staffing_events** and **staffing_event_shifts**, which link staff to specific classrooms and time slots without requiring a time-off request. Day-only reassignment uses `event_category = 'reassignment'` and `staffing_event_shifts.source_classroom_id` to move baseline staff for specific slots without mutating baseline schedules.
- Class-to-classroom mapping is expressed by **classroom_allowed_classes** (which class groups are allowed in which classrooms). Required/preferred staff come from **class_groups** (ratios) and **schedule_cells** / **schedule_cell_class_groups** (enrollment and overrides).
- Sub assignments track both full and partial shifts.
- Contact tracking uses **substitute_contacts** (per coverage request) and **sub_contact_shift_overrides** (per-shift overrides).

## Next Steps

1. Apply migrations to your Supabase project (see `supabase/README.md`)
2. Seed initial data (time slots and days of week are included in migrations)
3. Create API routes to interact with the database
4. Build UI components for data management
