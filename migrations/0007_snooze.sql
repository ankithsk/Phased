-- ---------------------------------------------------------------------------
-- Add snoozed_until to items.
-- Items with snoozed_until > today are hidden from phase lists by default.
-- Differs from revisit_at (which surfaces in digest): snooze is "hide this
-- from sight"; revisit is "bring this back to my attention".
-- ---------------------------------------------------------------------------

alter table items
  add column if not exists snoozed_until date;

create index if not exists items_snoozed_until_idx
  on items(snoozed_until)
  where snoozed_until is not null;
