-- ---------------------------------------------------------------------------
-- Seed the 8 starter projects for the current user.
-- Idempotent: no-op if user already has any projects.
-- Called from the client via supabase.rpc('seed_starter_projects').
-- ---------------------------------------------------------------------------

create or replace function seed_starter_projects() returns void
language plpgsql
security invoker
as $$
declare
  uid uuid := auth.uid();
  cnt int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into cnt from projects where user_id = uid;
  if cnt > 0 then
    return;
  end if;

  insert into projects (user_id, name, progress, color, sort_order) values
    (uid, 'NPL', 95, '#10b981', 1),
    (uid, 'AXIS Portal', 65, '#0ea5e9', 2),
    (uid, 'LinkSquares MCP', 98, '#8b5cf6', 3),
    (uid, 'ODP MCP', 30, '#f59e0b', 4),
    (uid, 'MS Teams Chatbot', 5, '#f43f5e', 5),
    (uid, 'Demand Planning Portal', 5, '#14b8a6', 6),
    (uid, 'AI Self Hosting', 1, '#71717a', 7),
    (uid, 'Floranex Scrollable Animation Website', 40, '#d946ef', 8);
end $$;
