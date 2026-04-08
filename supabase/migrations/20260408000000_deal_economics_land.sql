-- Add land_sqft and laydown_sqft to deal_economics
-- land_sqft: total land/lot size for non-vacant-land properties (SF)
-- laydown_sqft: laydown yard size (industrial/warehouse) (SF)
ALTER TABLE deal_economics ADD COLUMN IF NOT EXISTS land_sqft numeric;
ALTER TABLE deal_economics ADD COLUMN IF NOT EXISTS laydown_sqft numeric;
