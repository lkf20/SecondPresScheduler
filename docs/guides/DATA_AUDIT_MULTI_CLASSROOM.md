# Multi-classroom coverage — data audit (staging / production)

Run these **read-only** queries against staging or production **before** relying on migration 121 backfills or removing legacy `assign-sub/shifts` map fallbacks.

## 1. Multi-room teachers (baseline)

Teachers scheduled in more than one classroom for the same day × slot:

```sql
SELECT teacher_id, day_of_week_id, time_slot_id, COUNT(*) AS room_count
FROM teacher_schedules
WHERE classroom_id IS NOT NULL
GROUP BY teacher_id, day_of_week_id, time_slot_id
HAVING COUNT(*) > 1;
```

## 2. Active coverage shifts with null classroom

If this returns rows, the `keySimple` fallback in `POST /api/assign-sub/shifts` is still needed until data is repaired.

```sql
SELECT COUNT(*) FROM coverage_request_shifts
WHERE status = 'active' AND classroom_id IS NULL;
```

## 3. Multi-room absences under-covered

`time_off_shifts` where the teacher has more distinct baseline classrooms than distinct active `coverage_request_shifts` for that date/slot:

```sql
SELECT tos.id AS time_off_shift_id, tor.teacher_id, tos.date, tos.time_slot_id,
  COUNT(DISTINCT ts.classroom_id) AS teacher_rooms,
  COUNT(DISTINCT crs.id) AS coverage_shifts
FROM time_off_shifts tos
JOIN time_off_requests tor ON tor.id = tos.time_off_request_id
JOIN teacher_schedules ts ON ts.teacher_id = tor.teacher_id
  AND ts.time_slot_id = tos.time_slot_id
  AND ts.classroom_id IS NOT NULL
  AND ts.day_of_week_id = tos.day_of_week_id
LEFT JOIN coverage_request_shifts crs ON crs.coverage_request_id = tor.coverage_request_id
  AND crs.date = tos.date AND crs.time_slot_id = tos.time_slot_id AND crs.status = 'active'
GROUP BY tos.id, tor.teacher_id, tos.date, tos.time_slot_id
HAVING COUNT(DISTINCT ts.classroom_id) > COUNT(DISTINCT crs.id);
```

Record counts in the PR or runbook when migration 121 is applied.
