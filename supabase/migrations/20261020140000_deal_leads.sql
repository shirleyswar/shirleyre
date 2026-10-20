-- Deal leads. Matthew runs this by hand. Do not apply from the app.
-- People who expressed serious interest in one deal.
-- lead_date is a calendar date. It has no default on purpose:
-- CURRENT_DATE follows the database clock (UTC on Supabase) and would
-- shift the day. The app sends the local calendar date.

CREATE TABLE IF NOT EXISTS public.deal_leads (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid        NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  company       text,
  phone         text,
  email         text,
  serious_level text        NOT NULL,
  lead_date     date        NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_leads_serious_level_check
    CHECK (serious_level IN ('warm', 'hot', 'offer_likely'))
);

CREATE INDEX IF NOT EXISTS deal_leads_deal_id_created_at_idx
  ON public.deal_leads (deal_id, created_at DESC);

ALTER TABLE public.deal_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_deal_leads" ON public.deal_leads;
CREATE POLICY "anon_all_deal_leads"
  ON public.deal_leads
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.deal_leads TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
