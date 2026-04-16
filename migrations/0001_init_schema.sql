-- ---------------------------------------------------------------------------
-- Project Command Center — initial schema
-- Run order: 0001 -> 0002 -> 0003 -> 0004 -> 0005
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------- projects -------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused','completed')),
  color text,
  progress int not null default 0 check (progress between 0 and 100),
  modules_enabled boolean not null default false,
  last_visited_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------- modules --------------------------------------------------
create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  is_general boolean not null default false,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------- phases ---------------------------------------------------
create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  module_id uuid references modules(id) on delete cascade,
  number int not null,
  name text not null,
  status text not null default 'planned' check (status in ('active','planned','completed')),
  target_date date,
  is_current boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------- items ----------------------------------------------------
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phase_id uuid not null references phases(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'note' check (type in ('feature','bug','feedback','note','decision')),
  source text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in-progress','done','deferred')),
  pinned boolean not null default false,
  archived boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------- item_links -----------------------------------------------
create table if not exists item_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  from_item_id uuid not null references items(id) on delete cascade,
  to_item_id uuid not null references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_item_id, to_item_id),
  check (from_item_id <> to_item_id)
);

-- ---------------- activity_log ---------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------- current-phase uniqueness ---------------------------------
-- One current phase per project when module_id is null
create unique index if not exists one_current_phase_per_project
  on phases(project_id)
  where is_current = true and module_id is null;

-- One current phase per module when module_id is not null
create unique index if not exists one_current_phase_per_module
  on phases(module_id)
  where is_current = true and module_id is not null;

-- ---------------- updated_at trigger ---------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_projects_updated on projects;
drop trigger if exists trg_modules_updated  on modules;
drop trigger if exists trg_phases_updated   on phases;
drop trigger if exists trg_items_updated    on items;

create trigger trg_projects_updated before update on projects for each row execute function set_updated_at();
create trigger trg_modules_updated  before update on modules  for each row execute function set_updated_at();
create trigger trg_phases_updated   before update on phases   for each row execute function set_updated_at();
create trigger trg_items_updated    before update on items    for each row execute function set_updated_at();
