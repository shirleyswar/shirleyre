-- §5.11.5 / §13.2 — task.entity_id nullable FK
-- Enables meta line to render ROOSTER / entity name instead of encoding it in title.
-- Mirrors desktop D5 entities route. Mobile is_life|is_entity flag remains two-value;
-- entity_id adds the per-company FK beside it.
-- With entity_id: title = "Taxes", meta line = "ROOSTER" (entity name).
-- Without: current workaround "Taxes: Rooster" encoded in title.

-- entities table may not exist yet; create if absent
CREATE TABLE IF NOT EXISTS entities (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES entities(id) ON DELETE SET NULL;

GRANT ALL ON entities TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
