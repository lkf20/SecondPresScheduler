-- Allow both 'flex_assignment' and 'temporary_coverage' so inserts succeed whether
-- migration 093 has been applied or not (fixes "staffing_events_event_type_check" violation
-- when app sends event_type = 'temporary_coverage' and DB only allowed 'flex_assignment').

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'staffing_events'::regclass
      AND contype = 'c'
      AND conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'staffing_events'::regclass AND attname = 'event_type')::smallint]
  ) LOOP
    EXECUTE 'ALTER TABLE staffing_events DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE staffing_events
ADD CONSTRAINT staffing_events_event_type_check
CHECK (event_type IN ('flex_assignment', 'temporary_coverage'));
