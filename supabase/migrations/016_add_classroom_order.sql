-- Add order field to classrooms table for display ordering
ALTER TABLE classrooms
ADD COLUMN IF NOT EXISTS "order" INTEGER;

