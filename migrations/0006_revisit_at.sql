-- ---------------------------------------------------------------------------
-- Add revisit_at to items.
-- Nullable date the user wants to revisit an item on. The digest surfaces
-- items where revisit_at <= today ("Due to revisit") and items where
-- revisit_at is within the next 7 days ("Coming up").
-- ---------------------------------------------------------------------------

alter table items
  add column if not exists revisit_at date;

-- Partial index — only items with a revisit date get scanned by digest
-- queries, so skip the null-heavy majority of rows.
create index if not exists items_revisit_at_idx
  on items(revisit_at)
  where revisit_at is not null;
