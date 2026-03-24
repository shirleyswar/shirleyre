-- ============================================================
-- ShirleyCRE War Room V2 — Supabase Migration
-- Created: 2026-03-23
-- Run once in: https://supabase.com/dashboard/project/mtkyyaorvensylrfbhxv/sql/new
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. DEALS TABLE
-- Central source of truth. Two tiers: tracked (War Room only)
-- and filed (War Room + Dropbox folder via folder_queue).
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  address               TEXT,
  type                  TEXT NOT NULL CHECK (type IN ('listing','buyer_rep','tenant_rep','landlord_rep','consulting','other')),
  status                TEXT NOT NULL DEFAULT 'pipeline' CHECK (status IN ('pipeline','active','under_contract','pending_payment','closed','dead')),
  tier                  TEXT NOT NULL DEFAULT 'tracked' CHECK (tier IN ('tracked','filed')),
  value                 NUMERIC(15,2),
  commission_rate       NUMERIC(5,4),      -- decimal: 0.03 = 3%
  commission_estimated  NUMERIC(15,2),     -- calculated or manual
  commission_collected  NUMERIC(15,2) DEFAULT 0,
  deal_source           TEXT,              -- referral, cold call, website, etc.
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. TASKS TABLE
-- Action items, follow-ups, and to-dos.
-- Self-referential parent_task_id for sub-tasks.
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','complete','deferred')),
  due_date        DATE,
  completed_by    TEXT,                  -- who completed it (Matthew or agent name)
  parent_task_id  UUID REFERENCES tasks(id) ON DELETE SET NULL,  -- for sub-tasks
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. CONTACTS TABLE
-- People across all deals: clients, prospects, partners, EHVP/HVP.
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  company         TEXT,
  phone           TEXT,
  email           TEXT,
  role            TEXT,              -- broker, client, attorney, lender, etc.
  referral_source TEXT,              -- who sent them
  notes           TEXT,
  priority        TEXT NOT NULL DEFAULT 'standard' CHECK (priority IN ('ehvp','hvp','standard')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. DEAL_CONTACTS JUNCTION TABLE
-- Links contacts to deals with a relationship descriptor.
-- One contact can be on many deals; one deal can have many contacts.
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  relationship    TEXT,              -- "listing client", "buyer rep", "tenant", "attorney", etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, contact_id)
);

-- ============================================================
-- 5. ACTIVITY_LOG TABLE
-- Timestamped audit trail of everything that happens.
-- deal_id and contact_id are optional — some entries are global.
-- This is the "Completed Log" plus all automated agent actions.
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL,     -- "task_completed", "deal_launched", "note_added", etc.
  description     TEXT,
  created_by      TEXT,              -- "matthew", "shirleycre", "system"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. FOLDER_QUEUE TABLE
-- Dropbox folder operations queue.
-- War Room writes → Matthew's local script reads → creates/moves folders.
-- Sanka never touches Dropbox directly. This is the security boundary.
-- ============================================================
CREATE TABLE IF NOT EXISTS folder_queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id             UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  action              TEXT NOT NULL CHECK (action IN ('create','move')),
  folder_name         TEXT NOT NULL,       -- assembled per FILING.md naming conventions
  folder_path         TEXT NOT NULL,       -- full Dropbox destination path
  subfolder_template  TEXT,                -- 'active_listing' | 'active_project' | 'portfolio'
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','error')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  error_message       TEXT
);

-- ============================================================
-- INDEXES — for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_deals_status    ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_tier      ON deals(tier);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id   ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date  ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_contacts_priority ON contacts(priority);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal ON deal_contacts(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_contact ON deal_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_activity_deal   ON activity_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_folder_queue_status ON folder_queue(status);
CREATE INDEX IF NOT EXISTS idx_folder_queue_deal   ON folder_queue(deal_id);

-- ============================================================
-- ROW LEVEL SECURITY — enable but allow all for now (PIN-gated app)
-- Tighten when ShirleyCRE agent access is added.
-- ============================================================
ALTER TABLE deals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_queue    ENABLE ROW LEVEL SECURITY;

-- Temporary open policies (anon key from PIN-gated client)
-- Replace with proper auth policies when ShirleyCRE agent is integrated
CREATE POLICY "anon_all_deals"         ON deals         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_tasks"         ON tasks         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_contacts"      ON contacts      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_deal_contacts" ON deal_contacts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_activity_log"  ON activity_log  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_folder_queue"  ON folder_queue  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- SESSION 2 ADDITIONS — March 23, 2026
-- Run via Supabase SQL Editor: https://supabase.com/dashboard/project/mtkyyaorvensylrfbhxv/sql/new
-- ============================================================

-- Entity registry (LLCs, partnerships, personal CRE entities)
CREATE TABLE IF NOT EXISTS entities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT,                      -- 'LLC', 'S-Corp', 'Trust', 'Partnership', etc.
  notes         TEXT,
  dropbox_link  TEXT,                      -- link to Dropbox folder for this entity
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sub-items within each entity (tenant rosters, tax return tracking, etc.)
CREATE TABLE IF NOT EXISTS entity_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Personal tasks (Life panel — separate from business tasks)
CREATE TABLE IF NOT EXISTS personal_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  emoji       TEXT DEFAULT '📋',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for session 2 tables
CREATE INDEX IF NOT EXISTS idx_entity_items_entity ON entity_items(entity_id);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_status ON personal_tasks(status);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_order  ON personal_tasks(sort_order);

-- RLS for session 2 tables
ALTER TABLE entities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

-- Open read policies (anon PIN-gated client) — read + write for all
CREATE POLICY "anon read entities"       ON entities       FOR SELECT TO anon USING (true);
CREATE POLICY "anon write entities"      ON entities       FOR ALL    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon read entity_items"   ON entity_items   FOR SELECT TO anon USING (true);
CREATE POLICY "anon write entity_items"  ON entity_items   FOR ALL    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon read personal_tasks" ON personal_tasks FOR SELECT TO anon USING (true);
CREATE POLICY "anon write personal_tasks" ON personal_tasks FOR ALL   TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- DONE. Full schema:
--   deals, tasks, contacts, deal_contacts, activity_log, folder_queue
--   entities, entity_items, personal_tasks  (Session 2)
-- ============================================================
