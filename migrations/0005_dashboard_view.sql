-- ---------------------------------------------------------------------------
-- Dashboard summary RPC
-- Returns per-project open-item counts by priority + current phase name.
-- ---------------------------------------------------------------------------

create or replace function project_summaries()
returns table(
  project_id uuid,
  open_critical int,
  open_high int,
  open_medium int,
  open_low int,
  current_phase_name text
)
language sql
stable
security invoker
as $$
  with per_project as (
    select p.id as project_id,
      count(*) filter (
        where i.status <> 'done' and i.priority = 'critical' and not i.archived
      )::int as open_critical,
      count(*) filter (
        where i.status <> 'done' and i.priority = 'high' and not i.archived
      )::int as open_high,
      count(*) filter (
        where i.status <> 'done' and i.priority = 'medium' and not i.archived
      )::int as open_medium,
      count(*) filter (
        where i.status <> 'done' and i.priority = 'low' and not i.archived
      )::int as open_low
    from projects p
    left join phases ph on ph.project_id = p.id
    left join items i on i.phase_id = ph.id
    where p.user_id = auth.uid()
    group by p.id
  ),
  current_phase as (
    -- Pick one current phase per project. Prefer a project-scoped phase
    -- (module_id null) when one exists; otherwise fall back to a
    -- module-scoped current phase so dashboards for module-based projects
    -- still show the current phase name.
    select distinct on (ph.project_id) ph.project_id, ph.name
    from phases ph
    where ph.user_id = auth.uid()
      and ph.is_current = true
    order by ph.project_id,
             case when ph.module_id is null then 0 else 1 end,
             ph.number asc
  )
  select pp.project_id, pp.open_critical, pp.open_high, pp.open_medium, pp.open_low, cp.name
  from per_project pp
  left join current_phase cp on cp.project_id = pp.project_id;
$$;
