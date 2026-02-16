BEGIN;

-- Upgrade audit_log schema for Activity Log V1
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS actor_display_name text;

UPDATE public.audit_log
SET category = 'unknown'
WHERE category IS NULL;

ALTER TABLE public.audit_log
  ALTER COLUMN category SET DEFAULT 'unknown',
  ALTER COLUMN category SET NOT NULL;

UPDATE public.audit_log
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.audit_log
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.audit_log
  ALTER COLUMN actor_user_id DROP NOT NULL;

-- Ensure actor FK stays ON DELETE SET NULL
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Feed-focused indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_school_created_at
  ON public.audit_log (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_school_category_created_at
  ON public.audit_log (school_id, category, created_at DESC);

-- Keep baseline hardening
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audit_log FROM anon;
REVOKE ALL ON TABLE public.audit_log FROM authenticated;

-- Replace older policies with admin/director-scoped activity policies
DROP POLICY IF EXISTS "Users can view audit logs for their school" ON public.audit_log;
DROP POLICY IF EXISTS "Users can insert audit logs for their school" ON public.audit_log;
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;

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
      AND p.role::text IN ('admin', 'director')
  )
);

CREATE POLICY audit_log_insert
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.school_id = audit_log.school_id
      AND p.role::text IN ('admin', 'director')
  )
  AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
);

COMMIT;
