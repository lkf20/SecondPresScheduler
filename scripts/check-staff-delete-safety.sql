-- Staff hard-delete safety audit
-- Purpose:
-- 1) Show where a given staff ID appears via FK references to public.staff(id)
-- 2) Show where it appears in likely non-FK UUID columns (staff_id/teacher_id/sub_id)
-- 3) Help you decide whether hard delete is safe before running DELETE
--
-- Usage:
-- - Replace the UUID below once, then run the whole script in Supabase SQL Editor.
-- - This script does NOT delete anything.

DO $$
DECLARE
  v_staff_id UUID := '27d5de55-83e3-4afa-be24-de6a7487ed9b'::uuid;
  r RECORD;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _staff_fk_reference_counts (
    table_schema TEXT,
    table_name TEXT,
    column_name TEXT,
    fk_name TEXT,
    on_delete TEXT,
    row_count BIGINT
  ) ON COMMIT DROP;

  TRUNCATE _staff_fk_reference_counts;

  -- 1) True FK references to staff(id)
  FOR r IN
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      a.attname AS column_name,
      con.conname AS fk_name,
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE con.confdeltype::text
      END AS on_delete
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = con.conkey[1]
    JOIN pg_class c_ref ON c_ref.oid = con.confrelid
    JOIN pg_namespace n_ref ON n_ref.oid = c_ref.relnamespace
    WHERE con.contype = 'f'
      AND n_ref.nspname = 'public'
      AND c_ref.relname = 'staff'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'INSERT INTO _staff_fk_reference_counts
       SELECT %L, %L, %L, %L, %L, count(*)
       FROM %I.%I
       WHERE %I = $1',
      r.table_schema,
      r.table_name,
      r.column_name,
      r.fk_name,
      r.on_delete,
      r.table_schema,
      r.table_name,
      r.column_name
    )
    USING v_staff_id;
  END LOOP;
END $$;

-- Basic staff row check
SELECT
  id,
  first_name,
  last_name,
  display_name,
  is_teacher,
  is_sub,
  active,
  school_id,
  created_at,
  updated_at
FROM public.staff
WHERE id = '27d5de55-83e3-4afa-be24-de6a7487ed9b'::uuid;

-- FK references summary (includes ON DELETE action)
SELECT
  table_schema,
  table_name,
  column_name,
  fk_name,
  on_delete,
  row_count
FROM _staff_fk_reference_counts
ORDER BY row_count DESC, table_name, column_name;

-- FK references that currently contain this staff ID
SELECT
  table_schema,
  table_name,
  column_name,
  fk_name,
  on_delete,
  row_count
FROM _staff_fk_reference_counts
WHERE row_count > 0
ORDER BY row_count DESC, table_name, column_name;

-- 2) Non-FK heuristic scan:
-- Look for UUID columns named staff_id/teacher_id/sub_id in public schema
-- that are not already part of FK->staff(id), then count matches.
DO $$
DECLARE
  v_staff_id UUID := '27d5de55-83e3-4afa-be24-de6a7487ed9b'::uuid;
  r RECORD;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _staff_nonfk_reference_counts (
    table_schema TEXT,
    table_name TEXT,
    column_name TEXT,
    row_count BIGINT
  ) ON COMMIT DROP;

  TRUNCATE _staff_nonfk_reference_counts;

  FOR r IN
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.udt_name = 'uuid'
      AND c.column_name IN ('staff_id', 'teacher_id', 'sub_id')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = con.conkey[1]
        JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid
        JOIN pg_namespace ref_ns ON ref_ns.oid = ref_cls.relnamespace
        WHERE con.contype = 'f'
          AND ns.nspname = c.table_schema
          AND cls.relname = c.table_name
          AND att.attname = c.column_name
          AND ref_ns.nspname = 'public'
          AND ref_cls.relname = 'staff'
      )
  LOOP
    EXECUTE format(
      'INSERT INTO _staff_nonfk_reference_counts
       SELECT %L, %L, %L, count(*)
       FROM %I.%I
       WHERE %I = $1',
      r.table_schema,
      r.table_name,
      r.column_name,
      r.table_schema,
      r.table_name,
      r.column_name
    )
    USING v_staff_id;
  END LOOP;
END $$;

SELECT
  table_schema,
  table_name,
  column_name,
  row_count
FROM _staff_nonfk_reference_counts
ORDER BY row_count DESC, table_name, column_name;

SELECT
  table_schema,
  table_name,
  column_name,
  row_count
FROM _staff_nonfk_reference_counts
WHERE row_count > 0
ORDER BY row_count DESC, table_name, column_name;

-- 3) Final safety summary:
-- hard delete is considered safe only when:
-- - no non-cascade FK references exist for this staff_id
-- - no heuristic non-FK UUID references exist for this staff_id
WITH fk_blockers AS (
  SELECT COALESCE(SUM(row_count), 0) AS blocking_fk_rows
  FROM _staff_fk_reference_counts
  WHERE row_count > 0
    AND on_delete <> 'CASCADE'
),
nonfk_hits AS (
  SELECT COALESCE(SUM(row_count), 0) AS non_fk_rows
  FROM _staff_nonfk_reference_counts
  WHERE row_count > 0
)
SELECT
  CASE
    WHEN fk_blockers.blocking_fk_rows = 0 AND nonfk_hits.non_fk_rows = 0 THEN true
    ELSE false
  END AS safe_to_hard_delete,
  fk_blockers.blocking_fk_rows,
  nonfk_hits.non_fk_rows;

-- Optional: delete preview (safe rollback)
-- Uncomment to test whether DELETE would succeed, then rollback.
-- BEGIN;
-- DELETE FROM public.staff WHERE id = '27d5de55-83e3-4afa-be24-de6a7487ed9b'::uuid;
-- ROLLBACK;
