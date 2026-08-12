-- §20.1 intake — deal.property_type, sixth required field
-- Five-value enum per directive: INDUSTRIAL | LAND | OFFICE | OTHER | RETAIL
-- Deals with null property_type display as OTHER in the TYPE filter.
-- Sixth field for intake: property type picker added to NewDealSheet.

ALTER TABLE deals ADD COLUMN IF NOT EXISTS property_type text
  CHECK (property_type IN ('INDUSTRIAL', 'LAND', 'OFFICE', 'OTHER', 'RETAIL'));

COMMENT ON COLUMN deals.property_type IS 'Five-value enum: INDUSTRIAL | LAND | OFFICE | OTHER | RETAIL';
