-- 163 Item 5: add logged_at, note, note_typed_at to money_movers
ALTER TABLE money_movers ADD COLUMN IF NOT EXISTS logged_at timestamptz;
ALTER TABLE money_movers ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE money_movers ADD COLUMN IF NOT EXISTS note_typed_at timestamptz;
