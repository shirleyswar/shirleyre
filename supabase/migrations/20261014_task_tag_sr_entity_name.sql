-- Additive task tags. Does not update or delete existing rows.
-- is_sr matches is_life / is_entity (boolean, default false).
-- entity_name stores the company chosen from the Entity sub-row.
-- The app saves Life and Entity without these columns. SR and the
-- company name stick only after this runs.
--
-- Run in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/mtkyyaorvensylrfbhxv/sql/new

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_sr boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS entity_name text;

NOTIFY pgrst, 'reload schema';
