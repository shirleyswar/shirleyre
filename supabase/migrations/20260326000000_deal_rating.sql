-- Add rating column to deals table (1-5 stars)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS rating smallint CHECK (rating >= 1 AND rating <= 5);
