-- Add current_price and current_value to sold_positions
-- current_price: latest market price (refreshed server-side via edge function)
-- current_value: qty × current_price ("if held today" value)
ALTER TABLE sold_positions ADD COLUMN IF NOT EXISTS current_price numeric;
ALTER TABLE sold_positions ADD COLUMN IF NOT EXISTS current_value numeric;
ALTER TABLE sold_positions ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;
