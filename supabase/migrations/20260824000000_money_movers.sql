-- Check 58: money_movers table
-- Separate table for money mover pipeline entries (replaces is_money_mover flag on deals)

CREATE TABLE IF NOT EXISTS public.money_movers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  value numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.money_movers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'money_movers' AND policyname = 'anon read'
  ) THEN
    CREATE POLICY "anon read" ON public.money_movers FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'money_movers' AND policyname = 'anon write'
  ) THEN
    CREATE POLICY "anon write" ON public.money_movers FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'money_movers' AND policyname = 'anon update'
  ) THEN
    CREATE POLICY "anon update" ON public.money_movers FOR UPDATE TO anon USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
