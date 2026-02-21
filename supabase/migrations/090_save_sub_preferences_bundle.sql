-- Save sub preferences, qualifications, and capabilities atomically.
CREATE OR REPLACE FUNCTION save_sub_preferences_bundle(
  p_sub_id UUID,
  p_class_group_ids UUID[] DEFAULT '{}'::UUID[],
  p_qualifications JSONB DEFAULT '[]'::JSONB,
  p_capabilities JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id UUID;
  v_qualification JSONB;
  v_incoming_qualification_ids UUID[] := '{}'::UUID[];
BEGIN
  SELECT school_id
  INTO v_school_id
  FROM staff
  WHERE id = p_sub_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Sub/staff member not found';
  END IF;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23502',
      MESSAGE = 'school_id is required for sub preferences save';
  END IF;

  -- Update capabilities on staff row.
  UPDATE staff s
  SET
    can_change_diapers = CASE
      WHEN p_capabilities ? 'can_change_diapers' THEN (p_capabilities->>'can_change_diapers')::BOOLEAN
      ELSE s.can_change_diapers
    END,
    can_lift_children = CASE
      WHEN p_capabilities ? 'can_lift_children' THEN (p_capabilities->>'can_lift_children')::BOOLEAN
      ELSE s.can_lift_children
    END,
    can_assist_with_toileting = CASE
      WHEN p_capabilities ? 'can_assist_with_toileting' THEN (p_capabilities->>'can_assist_with_toileting')::BOOLEAN
      ELSE s.can_assist_with_toileting
    END,
    capabilities_notes = CASE
      WHEN p_capabilities ? 'capabilities_notes' THEN NULLIF(BTRIM(p_capabilities->>'capabilities_notes'), '')
      ELSE s.capabilities_notes
    END,
    updated_at = NOW()
  WHERE s.id = p_sub_id;

  -- Replace class preferences.
  DELETE FROM sub_class_preferences
  WHERE sub_id = p_sub_id;

  IF p_class_group_ids IS NOT NULL AND cardinality(p_class_group_ids) > 0 THEN
    INSERT INTO sub_class_preferences (sub_id, class_group_id, can_teach, school_id)
    SELECT
      p_sub_id,
      class_group_id,
      TRUE,
      v_school_id
    FROM unnest(p_class_group_ids) AS class_group_id
    GROUP BY class_group_id;
  END IF;

  -- Collect incoming qualification IDs.
  SELECT COALESCE(array_agg(DISTINCT (elem->>'qualification_id')::UUID), '{}'::UUID[])
  INTO v_incoming_qualification_ids
  FROM jsonb_array_elements(COALESCE(p_qualifications, '[]'::JSONB)) AS elem
  WHERE elem ? 'qualification_id'
    AND NULLIF(elem->>'qualification_id', '') IS NOT NULL;

  -- Delete removed qualifications.
  IF cardinality(v_incoming_qualification_ids) = 0 THEN
    DELETE FROM staff_qualifications
    WHERE staff_id = p_sub_id;
  ELSE
    DELETE FROM staff_qualifications q
    WHERE q.staff_id = p_sub_id
      AND q.qualification_id <> ALL(v_incoming_qualification_ids);
  END IF;

  -- Upsert incoming qualifications.
  FOR v_qualification IN
    SELECT elem
    FROM jsonb_array_elements(COALESCE(p_qualifications, '[]'::JSONB)) AS elem
    WHERE elem ? 'qualification_id'
      AND NULLIF(elem->>'qualification_id', '') IS NOT NULL
  LOOP
    INSERT INTO staff_qualifications (
      staff_id,
      qualification_id,
      level,
      expires_on,
      verified,
      notes
    )
    VALUES (
      p_sub_id,
      (v_qualification->>'qualification_id')::UUID,
      NULLIF(v_qualification->>'level', ''),
      NULLIF(v_qualification->>'expires_on', '')::DATE,
      CASE
        WHEN v_qualification ? 'verified' THEN (v_qualification->>'verified')::BOOLEAN
        ELSE NULL
      END,
      NULLIF(v_qualification->>'notes', '')
    )
    ON CONFLICT (staff_id, qualification_id)
    DO UPDATE SET
      level = EXCLUDED.level,
      expires_on = EXCLUDED.expires_on,
      verified = EXCLUDED.verified,
      notes = EXCLUDED.notes,
      updated_at = NOW();
  END LOOP;
END;
$$;
