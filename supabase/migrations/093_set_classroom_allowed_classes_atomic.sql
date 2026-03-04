-- Atomically replace allowed class groups for a classroom.
CREATE OR REPLACE FUNCTION set_classroom_allowed_classes_atomic(
  p_classroom_id UUID,
  p_class_group_ids UUID[] DEFAULT '{}'::UUID[],
  p_school_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id UUID;
  v_requested_count INTEGER := 0;
  v_valid_ids UUID[] := '{}'::UUID[];
BEGIN
  SELECT c.school_id
  INTO v_school_id
  FROM classrooms c
  WHERE c.id = p_classroom_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Classroom not found';
  END IF;

  IF p_school_id IS NOT NULL AND p_school_id <> v_school_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'school_id does not match classroom school';
  END IF;

  SELECT COUNT(DISTINCT requested.class_group_id)
  INTO v_requested_count
  FROM unnest(COALESCE(p_class_group_ids, '{}'::UUID[])) AS requested(class_group_id)
  WHERE requested.class_group_id IS NOT NULL;

  SELECT COALESCE(array_agg(valid.class_group_id), '{}'::UUID[])
  INTO v_valid_ids
  FROM (
    SELECT DISTINCT requested.class_group_id
    FROM unnest(COALESCE(p_class_group_ids, '{}'::UUID[])) AS requested(class_group_id)
    JOIN class_groups cg
      ON cg.id = requested.class_group_id
     AND cg.school_id = v_school_id
    WHERE requested.class_group_id IS NOT NULL
  ) AS valid;

  IF cardinality(v_valid_ids) <> v_requested_count THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'One or more class_group_ids are invalid for this school';
  END IF;

  DELETE FROM classroom_allowed_classes
  WHERE classroom_id = p_classroom_id
    AND school_id = v_school_id;

  IF cardinality(v_valid_ids) > 0 THEN
    INSERT INTO classroom_allowed_classes (classroom_id, class_group_id, school_id)
    SELECT p_classroom_id, class_group_id, v_school_id
    FROM unnest(v_valid_ids) AS class_group_id;
  END IF;
END;
$$;
