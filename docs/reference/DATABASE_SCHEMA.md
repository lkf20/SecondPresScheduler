# Database Schema Summary

## Overview

The database schema consists of 17 tables organized into logical groups:

## Tables Created

### Core Reference Tables (4)
1. **classrooms** - Physical room locations with capacity
2. **classes** - Logical class names with parent-child relationships
3. **time_slots** - Time periods (EM, AM, LB, AC) with default start/end times
4. **days_of_week** - Days of the week (Monday-Friday)

### People Tables (1)
5. **staff** - All staff members (teachers and subs) with first_name, last_name, display_name

### Schedule Tables (3)
6. **teacher_schedules** - Regular teacher weekly schedules
7. **sub_availability** - General sub availability by day/timeslot
8. **sub_availability_exceptions** - One-off availability exceptions by date

### Preference Tables (2)
9. **sub_class_preferences** - Which classes subs can/cannot teach
10. **classroom_preferences** - Who can teach in each classroom

### Rules & Configuration Tables (3)
11. **class_classroom_mappings** - Which classes are in which classrooms (varies by day/timeslot)
12. **staffing_rules** - Teacher ratios (preferred vs required) per class/day/timeslot
13. **enrollments** - Class enrollment counts per day/timeslot

### Assignment & Calendar Tables (4)
14. **time_off_requests** - Teacher time off requests
15. **sub_assignments** - Actual sub assignments (master calendar)
16. **sub_contact_overrides** - Contact tracking and shift overrides
17. **sub_contact_log** - Historical log of all sub contacts

## Key Features

- **UUID Primary Keys** - All tables use UUID for unique identification
- **Foreign Key Constraints** - Ensures referential integrity
- **Unique Constraints** - Prevents duplicate data where appropriate
- **Automatic Timestamps** - `created_at` and `updated_at` managed automatically
- **Triggers** - Auto-update `updated_at` on row updates
- **Indexes** - Performance indexes on frequently queried columns
- **Row Level Security** - RLS policies for data access control

## Relationships

- Staff can be both teachers and subs (via `is_teacher` and `is_sub` flags)
- Class-to-Classroom mapping is many-to-many and varies by day and timeslot
- Staffing rules are at the most specific level (class + day + timeslot)
- Sub assignments track both full and partial shifts
- Contact tracking supports multiple statuses and historical logging

## Next Steps

1. Apply migrations to your Supabase project (see `supabase/README.md`)
2. Seed initial data (time slots and days of week are included)
3. Create API routes to interact with the database
4. Build UI components for data management

