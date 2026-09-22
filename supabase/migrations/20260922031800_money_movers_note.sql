-- WARROOM-168: persist money mover notes.
-- Live money_movers (checked 2026-09-22) has id, title, deal_id, commission,
-- created_at, updated_at. note / note_typed_at / logged_at are absent.
-- 20260915000000_money_movers_logs.sql declares the same columns and was not applied.
-- Safe to re-run. logged_at stays because close-and-log already writes it.
-- Run this in the Supabase SQL editor if the dashboard has not applied migrations.

ALTER TABLE public.money_movers ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.money_movers ADD COLUMN IF NOT EXISTS note_typed_at timestamptz;
ALTER TABLE public.money_movers ADD COLUMN IF NOT EXISTS logged_at timestamptz;

NOTIFY pgrst, 'reload schema';
