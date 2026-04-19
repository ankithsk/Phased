-- ---------------------------------------------------------------------------
-- Goals: project-level objectives items can be tagged to.
-- Each goal has a status so we can surface only active ones in pickers but
-- keep achieved/dropped history for reference.
-- ---------------------------------------------------------------------------

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'achieved', 'dropped')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_goals_updated on goals;
create trigger trg_goals_updated before update on goals
  for each row execute function set_updated_at();

create index if not exists goals_project_idx on goals(project_id);

-- Items can optionally reference a goal. on delete set null so deleting a
-- goal doesn't destroy tagged items — they just become unassigned.
alter table items
  add column if not exists goal_id uuid references goals(id) on delete set null;

create index if not exists items_goal_id_idx
  on items(goal_id)
  where goal_id is not null;

-- ---------------- RLS ------------------------------------------------------

alter table goals enable row level security;

drop policy if exists "own_select_goals" on goals;
drop policy if exists "own_insert_goals" on goals;
drop policy if exists "own_update_goals" on goals;
drop policy if exists "own_delete_goals" on goals;

create policy "own_select_goals" on goals for select
  using (auth.uid() = user_id);
create policy "own_insert_goals" on goals for insert
  with check (auth.uid() = user_id);
create policy "own_update_goals" on goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own_delete_goals" on goals for delete
  using (auth.uid() = user_id);
