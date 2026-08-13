-- §18.3c EventSheet migration — schedule_events table
-- Written by agent. NOT applied — apply manually when ready.
-- Run: supabase db push OR psql with service role credentials.

create table if not exists schedule_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  text not null,   -- ISO date string "YYYY-MM-DD"
  event_time  text not null,   -- 24h "HH:MM"
  created_at  timestamptz not null default now()
);

-- RLS: restrict to authenticated users
alter table schedule_events enable row level security;

create policy "Authenticated users can read schedule_events"
  on schedule_events for select
  to authenticated
  using (true);

create policy "Authenticated users can insert schedule_events"
  on schedule_events for insert
  to authenticated
  with check (true);
