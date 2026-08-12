-- §19 Portfolios + §20 representation_role
-- portfolio: named grouping of deals for one client
-- deal.portfolio_id: nullable FK — not parent_deal_id
-- Counts and roll-ups are derived at read time; never stored on portfolio record.

CREATE TABLE IF NOT EXISTS portfolio (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- deal additions
ALTER TABLE deals ADD COLUMN IF NOT EXISTS portfolio_id uuid REFERENCES portfolio(id);

-- §20: representation_role — required field in new-deal intake; drives chain template selection
ALTER TABLE deals ADD COLUMN IF NOT EXISTS representation_role text
  CHECK (representation_role IN ('seller','landlord','buyer','tenant'));

-- §14.6.6: reporting cadence for active listings (default 7 calendar days)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS reporting_cadence_days integer DEFAULT 7;

GRANT ALL ON portfolio TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
