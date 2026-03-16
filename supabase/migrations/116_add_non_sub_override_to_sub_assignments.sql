-- Purpose: Persist explicit marker for director-assigned non-sub coverage rows.
ALTER TABLE public.sub_assignments
ADD COLUMN IF NOT EXISTS non_sub_override boolean NOT NULL DEFAULT false;
