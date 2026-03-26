-- Multi-classroom absence: one coverage_request_shift per classroom per time_off_shift.
-- Adds time_off_shift_id FK, backfills missing rows, replaces trigger, reconciles counters.

BEGIN;

-- 1) Link coverage rows back to the time_off_shift that created them (legacy rows use crs.id = tos.id)
ALTER TABLE coverage_request_shifts
ADD COLUMN IF NOT EXISTS time_off_shift_id UUID NULL
  REFERENCES time_off_shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coverage_request_shifts_time_off_shift
ON coverage_request_shifts(time_off_shift_id);

-- 2) Backfill time_off_shift_id where the primary key matches the time_off_shift row
UPDATE coverage_request_shifts crs
SET time_off_shift_id = crs.id
WHERE crs.time_off_shift_id IS NULL
  AND EXISTS (SELECT 1 FROM time_off_shifts tos WHERE tos.id = crs.id);

-- 3) Replace trigger: insert one active shift per classroom (first row keeps id = time_off_shift.id when multi-room)
CREATE OR REPLACE FUNCTION auto_create_coverage_request_shift_from_time_off_shift()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage_request_id UUID;
  v_school_id UUID;
  v_total INT;
  v_idx INT := 0;
  r RECORD;
BEGIN
  SELECT tor.coverage_request_id INTO v_coverage_request_id
  FROM time_off_requests tor
  WHERE tor.id = NEW.time_off_request_id;

  IF v_coverage_request_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cr.school_id INTO v_school_id
  FROM coverage_requests cr
  WHERE cr.id = v_coverage_request_id;

  SELECT COUNT(DISTINCT ts.classroom_id) INTO v_total
  FROM teacher_schedules ts
  JOIN time_off_requests tor ON ts.teacher_id = tor.teacher_id
  WHERE tor.id = NEW.time_off_request_id
    AND ts.day_of_week_id = NEW.day_of_week_id
    AND ts.time_slot_id = NEW.time_slot_id
    AND ts.school_id = v_school_id
    AND ts.classroom_id IS NOT NULL;

  IF v_total IS NULL OR v_total < 1 THEN
    RAISE EXCEPTION
      'Cannot create coverage shift: teacher has no scheduled classroom for this day/slot in this school. Add the teacher to the baseline schedule (Settings → Baseline Schedule) first.'
      USING ERRCODE = 'P0001';
  END IF;

  FOR r IN
    SELECT DISTINCT ON (ts.classroom_id)
      ts.classroom_id AS cid,
      NULLIF(to_jsonb(ts)->>'class_group_id', '')::uuid AS cgid
    FROM teacher_schedules ts
    JOIN time_off_requests tor ON ts.teacher_id = tor.teacher_id
    WHERE tor.id = NEW.time_off_request_id
      AND ts.day_of_week_id = NEW.day_of_week_id
      AND ts.time_slot_id = NEW.time_slot_id
      AND ts.school_id = v_school_id
      AND ts.classroom_id IS NOT NULL
    ORDER BY ts.classroom_id, NULLIF(to_jsonb(ts)->>'class_group_id', '')::uuid NULLS LAST
  LOOP
    v_idx := v_idx + 1;

    IF v_total = 1 THEN
      INSERT INTO coverage_request_shifts (
        id,
        coverage_request_id,
        date,
        day_of_week_id,
        time_slot_id,
        classroom_id,
        class_group_id,
        is_partial,
        start_time,
        end_time,
        school_id,
        created_at,
        time_off_shift_id
      ) VALUES (
        NEW.id,
        v_coverage_request_id,
        NEW.date,
        NEW.day_of_week_id,
        NEW.time_slot_id,
        r.cid,
        r.cgid,
        NEW.is_partial,
        NEW.start_time,
        NEW.end_time,
        v_school_id,
        NEW.created_at,
        NEW.id
      )
      ON CONFLICT (id) DO NOTHING;

    ELSIF v_idx = 1 THEN
      INSERT INTO coverage_request_shifts (
        id,
        coverage_request_id,
        date,
        day_of_week_id,
        time_slot_id,
        classroom_id,
        class_group_id,
        is_partial,
        start_time,
        end_time,
        school_id,
        created_at,
        time_off_shift_id
      ) VALUES (
        NEW.id,
        v_coverage_request_id,
        NEW.date,
        NEW.day_of_week_id,
        NEW.time_slot_id,
        r.cid,
        r.cgid,
        NEW.is_partial,
        NEW.start_time,
        NEW.end_time,
        v_school_id,
        NEW.created_at,
        NEW.id
      )
      ON CONFLICT ON CONSTRAINT coverage_request_shifts_request_date_slot_classroom_key DO NOTHING;

    ELSE
      INSERT INTO coverage_request_shifts (
        id,
        coverage_request_id,
        date,
        day_of_week_id,
        time_slot_id,
        classroom_id,
        class_group_id,
        is_partial,
        start_time,
        end_time,
        school_id,
        created_at,
        time_off_shift_id
      ) VALUES (
        gen_random_uuid(),
        v_coverage_request_id,
        NEW.date,
        NEW.day_of_week_id,
        NEW.time_slot_id,
        r.cid,
        r.cgid,
        NEW.is_partial,
        NEW.start_time,
        NEW.end_time,
        v_school_id,
        NEW.created_at,
        NEW.id
      )
      ON CONFLICT ON CONSTRAINT coverage_request_shifts_request_date_slot_classroom_key DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3b) Allow multiple active rows per (coverage_request_id, date, time_slot_id) — one per classroom.
-- Migration 108 drops coverage_request_shifts_coverage_request_id_date_time_slot_id_key, but Postgres
-- truncates long constraint names to 63 chars, so the live name may differ and the old UNIQUE can survive.
-- The backfill below requires UNIQUE (coverage_request_id, date, time_slot_id, classroom_id) only.
ALTER TABLE coverage_request_shifts
  DROP CONSTRAINT IF EXISTS coverage_request_shifts_coverage_request_id_date_time_slot_id_key;

ALTER TABLE coverage_request_shifts
  DROP CONSTRAINT IF EXISTS coverage_request_shifts_coverage_request_id_date_time_slot__key;

DO $$
DECLARE
  r RECORD;
  cols text;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid, c.conkey
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'coverage_request_shifts'
      AND c.contype = 'u'
  LOOP
    SELECT string_agg(a.attname, ',' ORDER BY u.ord)
    INTO cols
    FROM unnest(r.conkey) WITH ORDINALITY AS u(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = r.conrelid AND a.attnum = u.attnum AND NOT a.attisdropped;

    IF cols = 'coverage_request_id,date,time_slot_id' THEN
      EXECUTE format('ALTER TABLE coverage_request_shifts DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'coverage_request_shifts'
      AND c.conname = 'coverage_request_shifts_request_date_slot_classroom_key'
  ) THEN
    ALTER TABLE coverage_request_shifts
      ADD CONSTRAINT coverage_request_shifts_request_date_slot_classroom_key
      UNIQUE (coverage_request_id, date, time_slot_id, classroom_id);
  END IF;
END $$;

-- 4) Additive backfill: missing per-classroom rows for existing time_off_shifts (multi-room floaters)
INSERT INTO coverage_request_shifts (
  id,
  coverage_request_id,
  date,
  day_of_week_id,
  time_slot_id,
  classroom_id,
  class_group_id,
  is_partial,
  start_time,
  end_time,
  school_id,
  status,
  created_at,
  time_off_shift_id
)
SELECT
  gen_random_uuid(),
  tor.coverage_request_id,
  tos.date,
  tos.day_of_week_id,
  tos.time_slot_id,
  ts.classroom_id,
  NULLIF(to_jsonb(ts)->>'class_group_id', '')::uuid AS class_group_id,
  COALESCE(tos.is_partial, false),
  tos.start_time,
  tos.end_time,
  cr.school_id,
  'active'::coverage_request_shift_status,
  tos.created_at,
  tos.id
FROM time_off_shifts tos
JOIN time_off_requests tor ON tor.id = tos.time_off_request_id
JOIN coverage_requests cr ON cr.id = tor.coverage_request_id
JOIN teacher_schedules ts ON ts.teacher_id = tor.teacher_id
  AND ts.day_of_week_id = tos.day_of_week_id
  AND ts.time_slot_id = tos.time_slot_id
  AND ts.school_id = cr.school_id
  AND ts.classroom_id IS NOT NULL
WHERE tor.coverage_request_id IS NOT NULL
  -- Match the UNIQUE key: any status counts (e.g. cancelled row still occupies the quad).
  AND NOT EXISTS (
    SELECT 1
    FROM coverage_request_shifts existing
    WHERE existing.coverage_request_id = tor.coverage_request_id
      AND existing.date = tos.date
      AND existing.time_slot_id = tos.time_slot_id
      AND existing.classroom_id = ts.classroom_id
  )
ON CONFLICT ON CONSTRAINT coverage_request_shifts_request_date_slot_classroom_key DO NOTHING;

-- 5) Ensure legacy rows link to time_off_shift after backfill
UPDATE coverage_request_shifts crs
SET time_off_shift_id = crs.id
WHERE crs.time_off_shift_id IS NULL
  AND EXISTS (SELECT 1 FROM time_off_shifts tos WHERE tos.id = crs.id);

-- 6) Reconcile coverage_requests.total_shifts, covered_shifts, status for all requests (safe full recompute)
UPDATE coverage_requests cr
SET
  total_shifts = COALESCE(t.total, 0),
  covered_shifts = LEAST(COALESCE(cv.covered, 0), COALESCE(t.total, 0)),
  status = CASE
    WHEN COALESCE(t.total, 0) = 0 THEN cr.status
    WHEN COALESCE(cv.covered, 0) >= COALESCE(t.total, 0) THEN 'filled'::coverage_request_status
    ELSE 'open'::coverage_request_status
  END,
  updated_at = NOW()
FROM (
  SELECT coverage_request_id, COUNT(*)::int AS total
  FROM coverage_request_shifts
  WHERE status = 'active'
  GROUP BY coverage_request_id
) t
LEFT JOIN (
  SELECT crs.coverage_request_id,
    COUNT(DISTINCT sa.coverage_request_shift_id)::int AS covered
  FROM sub_assignments sa
  INNER JOIN coverage_request_shifts crs
    ON crs.id = sa.coverage_request_shift_id AND crs.status = 'active'
  WHERE sa.status = 'active'
  GROUP BY crs.coverage_request_id
) cv ON cv.coverage_request_id = t.coverage_request_id
WHERE cr.id = t.coverage_request_id
  AND cr.status IN ('open', 'filled');

COMMIT;
