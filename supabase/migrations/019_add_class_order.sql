-- Add order column to classes table
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS "order" INTEGER;

