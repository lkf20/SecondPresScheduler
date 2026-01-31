BEGIN;

-- Allow authenticated users to insert audit logs for their own school
DROP POLICY IF EXISTS "Users can insert audit logs for their school" ON public.audit_log;

CREATE POLICY "Users can insert audit logs for their school"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = actor_user_id
    AND user_belongs_to_school(school_id)
  );

COMMIT;
