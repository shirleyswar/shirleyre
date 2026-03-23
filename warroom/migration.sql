-- ShirleyCRE War Room — Database Migration
-- Run this ONCE in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/mtkyyaorvensylrfbhxv/sql/new
-- 
-- Copy and paste everything below, then click "Run"

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- DEALS TABLE
-- Central registry of all active deals
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  type text,                          -- Sale, Lease, Land, etc.
  status text DEFAULT 'pipeline',     -- pipeline, active, under_contract, pending_payment, closed, dead
  value numeric,                      -- Deal value / commission estimate in dollars
  notes text,
  contact text,                       -- Primary contact name
  commission numeric,                 -- Commission amount
  sqft numeric,                       -- Square footage
  emoji text,                         -- User-applied emoji flag
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TASKS TABLE
-- Action items and battle plan items, optionally linked to deals
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  deal_name text,                     -- Denormalized for quick display
  title text NOT NULL,
  status text DEFAULT 'open',         -- open, done
  due_date date,
  person text,                        -- Who to act with / related contact
  commission text,                    -- Commission associated
  emoji text,
  done_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- CONTACTS TABLE
-- People: clients, prospects, brokers, vendors
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  company text,
  phone text,
  email text,
  role text,                          -- Client, Prospect, Broker, Vendor, EHVP, HVP
  notes text,
  priority text DEFAULT 'normal',     -- ehvp, hvp, normal
  emoji text,
  created_at timestamptz DEFAULT now()
);

-- FOLDER QUEUE TABLE
-- Tracks folder/file setup tasks for deals
CREATE TABLE IF NOT EXISTS public.folder_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  deal_name text,
  folder_name text,
  status text DEFAULT 'pending',      -- pending, done
  created_at timestamptz DEFAULT now()
);

-- Row Level Security: disable for now (PIN-gated app, single user)
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_queue ENABLE ROW LEVEL SECURITY;

-- Allow all operations with the anon key (PIN protects the frontend)
CREATE POLICY "Allow all for anon" ON public.deals FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.tasks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.contacts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.folder_queue FOR ALL TO anon USING (true) WITH CHECK (true);

-- Auto-update updated_at on deals
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
