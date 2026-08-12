-- §18 Voice Note — notes table
-- Phase 1: body + optional deal_id.
-- Reserved columns for Phase 3 (audio) and Phase 4 (geo) — do not remove.

CREATE TABLE IF NOT EXISTS notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  body        text        NOT NULL,
  deal_id     uuid        REFERENCES deals(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  -- Phase 3 reserved
  audio_path  text        NULL,
  -- Phase 4 reserved
  lat         double precision NULL,
  lng         double precision NULL
);

GRANT ALL ON notes TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
