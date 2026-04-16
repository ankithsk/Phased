-- ---------------------------------------------------------------------------
-- Performance indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_items_phase      on items(phase_id, archived, pinned);
create index if not exists idx_items_pinned     on items(user_id, archived) where pinned = true;
create index if not exists idx_items_tags       on items using gin(tags);
create index if not exists idx_items_fts        on items
  using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
create index if not exists idx_items_updated    on items(updated_at desc);

create index if not exists idx_activity_project on activity_log(project_id, created_at desc);
create index if not exists idx_projects_user_st on projects(user_id, status);
create index if not exists idx_phases_project   on phases(project_id, sort_order);
create index if not exists idx_modules_project  on modules(project_id, sort_order);
