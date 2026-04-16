-- ---------------------------------------------------------------------------
-- Row Level Security policies
-- Every table enforces: auth.uid() = user_id
-- ---------------------------------------------------------------------------

alter table projects     enable row level security;
alter table modules      enable row level security;
alter table phases       enable row level security;
alter table items        enable row level security;
alter table item_links   enable row level security;
alter table activity_log enable row level security;

do $$
declare
  t text;
  tables text[] := array['projects','modules','phases','items','activity_log','item_links'];
begin
  foreach t in array tables
  loop
    -- drop existing policies with the same names if re-run
    execute format('drop policy if exists "own_select_%1$s"  on %1$I;', t);
    execute format('drop policy if exists "own_insert_%1$s"  on %1$I;', t);
    execute format('drop policy if exists "own_update_%1$s"  on %1$I;', t);
    execute format('drop policy if exists "own_delete_%1$s"  on %1$I;', t);

    execute format('create policy "own_select_%1$s" on %1$I for select using (auth.uid() = user_id);', t);
    execute format('create policy "own_insert_%1$s" on %1$I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "own_update_%1$s" on %1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy "own_delete_%1$s" on %1$I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;
