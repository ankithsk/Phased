-- ---------------------------------------------------------------------------
-- Typed item_links: a pair can now be a plain link OR a dependency (blocks).
-- - relation = 'links'  : existing generic bidirectional relationship
-- - relation = 'blocks' : from_item_id blocks to_item_id (to is blocked by from)
--
-- The PK is widened to include relation so the same pair can exist in more
-- than one relation kind (rare, but valid).
-- ---------------------------------------------------------------------------

alter table item_links
  add column if not exists relation text not null default 'links'
  check (relation in ('links', 'blocks'));

alter table item_links drop constraint if exists item_links_pkey;
alter table item_links add primary key (from_item_id, to_item_id, relation);

create index if not exists item_links_to_relation_idx
  on item_links(to_item_id, relation);
create index if not exists item_links_from_relation_idx
  on item_links(from_item_id, relation);
