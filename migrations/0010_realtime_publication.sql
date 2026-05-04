-- Ensure the supabase_realtime publication carries every table whose changes
-- hooks listen for. Without this, postgres_changes subscriptions in the
-- client subscribe successfully but never fire — captures, status edits,
-- pins, archives etc. only appear after a manual refresh.
--
-- Idempotent: skip a table that's already a publication member, otherwise
-- ALTER PUBLICATION ADD TABLE errors with "is already member of publication".

do $$
declare
  t text;
  tables text[] := array[
    'projects',
    'modules',
    'phases',
    'items',
    'item_links',
    'goals',
    'activity_log'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- Realtime needs full row identity to deliver UPDATE payloads; otherwise the
-- old row is omitted and filter-on-old-value subscriptions silently drop.
alter table public.projects     replica identity full;
alter table public.modules      replica identity full;
alter table public.phases       replica identity full;
alter table public.items        replica identity full;
alter table public.item_links   replica identity full;
alter table public.goals        replica identity full;
alter table public.activity_log replica identity full;
