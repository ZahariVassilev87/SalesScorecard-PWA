-- Verify column exists
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='teams' ORDER BY ordinal_position;
-- Add if missing (idempotent)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS description VARCHAR(255);
-- Verify again
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='teams' ORDER BY ordinal_position;
-- Try a simple select that references description
SELECT id, name, description FROM public.teams LIMIT 1;
