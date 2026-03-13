# Database Schema Summary

## Overview

The database schema consists of 17 tables organized into logical groups:

## Tables Created

### Core Reference Tables (4)

1. **classrooms** - Physical room locations with capacity and optional notes
2. **classes** / **class_groups** - Logical class names with parent-child relationships; class_groups table includes optional notes
3. **time_slots** - Time periods (EM, AM, LB, AC) with default start/end times
4. **days_of_week** - Days of the week (Monday-Friday)

### People Tables (1)

5. **staff** - All staff members with first_name, last_name, display_name, and roles ('PERMANENT', 'FLEXIBLE', etc.)

### Schedule Tables (3)

6. **teacher_schedules** - Baseline Permanent and Baseline Flex weekly schedules
7. **sub_availability** - General sub availability by day/timeslot
8. **sub_availability_exceptions** - One-off availability exceptions by date

### Preference Tables (1)

9. **sub_class_preferences** - Which classes subs can/cannot teach

(Former table **classroom_preferences** was removed in migration 071.)

### Rules & Configuration Tables (2)

11. **class_classroom_mappings** - Which classes are in which classrooms (varies by day/timeslot)
12. **staffing_rules** - Teacher ratios (preferred vs required) per class/day/timeslot

(Enrollment is stored per cell in **schedule_cells** and **schedule_cell_class_groups**; the former **enrollments** table was removed in migration 106.)

### Assignment & Calendar Tables (6)

14. **time_off_requests** - Teacher time off requests
15. **sub_assignments** - Actual sub assignments (master calendar)
16. **staffing_events** - Grouping for Temporary Coverage assignments (formerly flex assignments)
17. **staffing_event_shifts** - Individual shift records for Temporary Coverage
18. **sub_contact_overrides** - Contact tracking and shift overrides
19. **sub_contact_log** - Historical log of all sub contacts

## Key Features

- **UUID Primary Keys** - All tables use UUID for unique identification
- **Foreign Key Constraints** - Ensures referential integrity
- **Unique Constraints** - Prevents duplicate data where appropriate
- **Automatic Timestamps** - `created_at` and `updated_at` managed automatically
- **Triggers** - Auto-update `updated_at` on row updates; `auto_create_coverage_request_shift_from_time_off_shift` (migration 104) creates a `coverage_request_shift` on INSERT into `time_off_shifts` and **raises** if the teacher has no scheduled classroom for that day/slot (no "Unknown" fallback)
- **Indexes** - Performance indexes on frequently queried columns
- **Row Level Security** - RLS policies for data access control

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

- Staff have roles ('PERMANENT', 'FLEXIBLE') to designate them as teachers. `is_teacher` is deprecated. Subs are indicated via the `is_sub` flag.
- Temporary Coverage is handled via `staffing_events` and `staffing_event_shifts`, which link staff to specific classrooms and time slots without requiring a time-off request.
- Class-to-Classroom mapping is many-to-many and varies by day and timeslot
- Staffing rules are at the most specific level (class + day + timeslot)
- Sub assignments track both full and partial shifts
- Contact tracking supports multiple statuses and historical logging

## Next Steps

1. Apply migrations to your Supabase project (see `supabase/README.md`)
2. Seed initial data (time slots and days of week are included)
3. Create API routes to interact with the database
4. Build UI components for data management
