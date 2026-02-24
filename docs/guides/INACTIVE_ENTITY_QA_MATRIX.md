# Inactive Entity QA Matrix

Use this matrix to verify behavior for all four entity types:

- `staff`
- `classrooms`
- `class_groups`
- `time_slots`

Test each entity in four states:

- active + unreferenced
- active + referenced
- inactive + unreferenced
- inactive + referenced

## Global Expectations

- New links to inactive entities are blocked by API guardrails.
- Existing historical links remain readable/editable.
- Weekly and Baseline filters treat inactive consistently.
- Pickers default to active-only and require `Show inactive` to reveal inactive options.

## Matrix

| Entity       | Active + Unreferenced                                       | Active + Referenced                                          | Inactive + Unreferenced                                                                                                        | Inactive + Referenced                                                                                                                            |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Staff        | Selectable in assignment/edit pickers.                      | Displays and remains editable in existing slots.             | Hidden by default from pickers; visible when `Show inactive` is enabled. Cannot create new schedule assignments to this staff. | Existing assignments remain visible. New assignments blocked. Warning shown on edit page that entity is inactive but still used in baseline.     |
| Classrooms   | Selectable in schedule edit flows.                          | Displays normally in weekly/baseline.                        | Hidden by default from picker/filter sets unless `Show inactive` is enabled. New schedule-cell links blocked.                  | Existing slots remain visible as inactive references. New links blocked. Warning shown on classroom edit page when baseline still references it. |
| Class Groups | Selectable in class-group picker and schedule cell editing. | Displays normally in schedule cell details and calculations. | Hidden by default in class-group picker unless `Show inactive` is enabled. New links blocked.                                  | Existing associations remain visible and removable. New links blocked. Warning shown on class-group edit page when baseline still references it. |
| Time Slots   | Selectable for new assignment/schedule actions.             | Displays normally in weekly/baseline and reports.            | Hidden by default in most picker/filter contexts unless `Show inactive` is enabled. New links blocked.                         | Existing rows remain visible as inactive references. New links blocked. Warning shown on time-slot edit page when baseline still references it.  |

## Verification Checklist

1. Weekly Schedule

- Toggle `Inactive` off in filters and confirm only inactive-but-referenced slots remain visible.
- Toggle `Inactive` on and confirm all inactive slots display.
- Confirm inactive cards use muted styling and match legend entry.

2. Baseline Schedule

- Repeat weekly filter checks.
- Confirm no new links can be created to inactive classroom/time slot/class group.

3. Side Panel / Pickers

- Confirm class-group picker defaults to active-only.
- Enable `Show inactive` and confirm inactive options appear with clear labeling.
- Confirm selecting an inactive class group fails only when introducing a new inactive link.

4. API Safety

- `createTeacherSchedule` blocks inactive staff/classroom/time-slot links.
- `bulkCreateTeacherSchedules` blocks inactive staff/classroom/time-slot links.
- `createScheduleCell` blocks inactive classroom/time-slot/class-group links.
- `bulkUpdateScheduleCells` blocks newly added inactive class-group links and new inactive classroom/time-slot links.

5. Edit Warnings

- Confirm inactive-but-referenced warnings render on edit pages for:
  - staff
  - classrooms
  - class groups
  - time slots
