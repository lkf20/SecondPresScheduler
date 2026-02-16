BEGIN;

-- Activity feed should be visible to all authenticated users in the same school.
-- Keep insert restrictions from prior migration (admin/director) unchanged.
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;

CREATE POLICY audit_log_select
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.school_id = audit_log.school_id
  )
);

COMMIT;
