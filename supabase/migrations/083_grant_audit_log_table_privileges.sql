BEGIN;

-- RLS policies require base table privileges for the role.
-- We intentionally keep anon locked out.
GRANT SELECT, INSERT ON TABLE public.audit_log TO authenticated;

COMMIT;
