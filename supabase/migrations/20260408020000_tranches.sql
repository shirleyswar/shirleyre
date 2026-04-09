-- Tranches: named groups of buy or sell positions
CREATE TABLE IF NOT EXISTS tranches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,                             -- e.g. "Dec/25", "Jan/26"
  type       TEXT NOT NULL CHECK (type IN ('buy','sell')),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Link existing tables to tranches
ALTER TABLE sleeve_positions ADD COLUMN IF NOT EXISTS tranche_id UUID REFERENCES tranches(id);
ALTER TABLE sold_positions   ADD COLUMN IF NOT EXISTS tranche_id UUID REFERENCES tranches(id);

-- Seed the two initial tranches and tag existing rows
DO $$
DECLARE
  sell_id UUID;
  buy_id  UUID;
BEGIN
  -- Sell: Dec/25 (existing sold_positions)
  INSERT INTO tranches (name, type, notes)
  VALUES ('Dec/25', 'sell', 'Initial portfolio cleanup — Dec 2025')
  RETURNING id INTO sell_id;

  UPDATE sold_positions SET tranche_id = sell_id WHERE tranche_id IS NULL;

  -- Buy: Jan/26 (existing sleeve_positions)
  INSERT INTO tranches (name, type, notes)
  VALUES ('Jan/26', 'buy', 'Initial sleeve / AGI concentration — Jan 2026')
  RETURNING id INTO buy_id;

  UPDATE sleeve_positions SET tranche_id = buy_id WHERE tranche_id IS NULL;
END $$;
