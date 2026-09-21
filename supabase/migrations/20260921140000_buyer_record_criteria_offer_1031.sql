-- 165: BUYER record criteria, offer, and 1031 columns
ALTER TABLE deal_economics
  ADD COLUMN IF NOT EXISTS buyer_prop_types      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_price_from      NUMERIC,
  ADD COLUMN IF NOT EXISTS buyer_price_to        NUMERIC,
  ADD COLUMN IF NOT EXISTS buyer_size_from_sf    NUMERIC,
  ADD COLUMN IF NOT EXISTS buyer_size_to_sf      NUMERIC,
  ADD COLUMN IF NOT EXISTS buyer_where           TEXT,
  ADD COLUMN IF NOT EXISTS buyer_funding         TEXT,
  ADD COLUMN IF NOT EXISTS buyer_1031            TEXT,
  ADD COLUMN IF NOT EXISTS buyer_1031_clock      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_1031_relinquished DATE,
  ADD COLUMN IF NOT EXISTS offer_price           NUMERIC,
  ADD COLUMN IF NOT EXISTS offer_date            DATE,
  ADD COLUMN IF NOT EXISTS offer_status          TEXT,
  ADD COLUMN IF NOT EXISTS offer_addr_display    TEXT;
