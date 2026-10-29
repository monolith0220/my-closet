-- Per-item favorites and purchase dates for the closet and saved outfit pairs.
alter table public.clothing_items
  add column is_favorite boolean not null default false,
  add column purchased_at date;

-- Existing purchase-history imports stored the date in memo. Ignore malformed
-- dates so one manually edited note cannot prevent the migration from running.
do $$
declare
  item record;
  parsed_date date;
begin
  for item in
    select id, substring(memo from '購入日:[[:space:]]*([0-9]{4}/[0-9]{1,2}/[0-9]{1,2})') as date_text
    from public.clothing_items
    where memo like '%購入日:%'
  loop
    if item.date_text is null then continue; end if;
    begin
      parsed_date := item.date_text::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      continue;
    end;
    update public.clothing_items set purchased_at = parsed_date where id = item.id;
  end loop;
end $$;

create index clothing_items_user_favorite_idx
  on public.clothing_items (user_id, is_favorite, created_at desc)
  where is_active;

-- A saved top-and-bottom pair has one item in each role. Other role names
-- remain available to future outfit features.
create unique index outfit_items_one_pair_role_idx
  on public.outfit_items (outfit_id, role)
  where role in ('top', 'bottom');
