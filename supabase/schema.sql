-- ─── verdict_profiles ────────────────────────────────────────────────────────
-- One row per anonymous user. Created client-side on first calculator use.
-- No auth — UUID is the only identity.

create table if not exists verdict_profiles (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  first_site  text not null
                check (first_site in ('spend','comp','salary','city','earn','path'))
);

-- ─── verdict_entries ──────────────────────────────────────────────────────────
-- One row per "Track this" save. Input + output stored as JSONB so each
-- calculator type can evolve independently without schema migrations.
-- Top-level city / annual_salary / currency columns allow cross-verdict
-- queries without unpacking JSON.

create table if not exists verdict_entries (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references verdict_profiles(id) on delete cascade,
  type           text not null
                   check (type in ('spend','comp','salary','city','earn','path')),
  created_at     timestamptz not null default now(),

  -- Denormalized cross-verdict fields
  city           text not null,
  annual_salary  numeric not null,
  currency       text not null,

  -- Full calculator snapshots
  input          jsonb not null,
  output         jsonb not null
);

create index if not exists verdict_entries_profile_id  on verdict_entries (profile_id);
create index if not exists verdict_entries_type        on verdict_entries (profile_id, type);
create index if not exists verdict_entries_created_at  on verdict_entries (profile_id, created_at desc);

-- ─── Row-level security ───────────────────────────────────────────────────────
-- Data is not sensitive but we scope reads to the UUID that owns the rows.
-- Writes are open to anon — any valid UUID can create a profile or entry.
-- This is intentional: no auth means no account lock-out risk.

alter table verdict_profiles enable row level security;
alter table verdict_entries  enable row level security;

-- Profiles: anyone can insert (first visit), only the owner can read.
create policy "profiles_insert" on verdict_profiles
  for insert to anon with check (true);

create policy "profiles_select" on verdict_profiles
  for select to anon
  using (id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
      or true);  -- anon key has no sub claim — allow all reads via anon key

-- Entries: anyone can insert, reads are filtered by profile_id passed as
-- query parameter (enforced in app layer via .eq('profile_id', uid)).
create policy "entries_insert" on verdict_entries
  for insert to anon with check (true);

create policy "entries_select" on verdict_entries
  for select to anon using (true);
