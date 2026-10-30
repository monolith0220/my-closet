-- Personal engagement data for ratings, view-aware outfit suggestions, and
-- explicit UNIQLO collection labels. Existing rows keep safe defaults.
alter table public.clothing_items
  add column collection text
    check (collection in ('UNIQLO U', 'UNIQLO : C')),
  add column rating smallint not null default 0
    check (rating between 0 and 5),
  add column view_count integer not null default 0
    check (view_count >= 0);

-- Label only products whose stored brand or name already says the collection.
-- Avoid inferring a collection from a product number or the ordinary UNIQLO brand.
update public.clothing_items
set collection = 'UNIQLO U'
where collection is null
  and (
    brand ~* '^(UNIQLO|ユニクロ)[[:space:]　]*U$'
    or name ~* '(UNIQLO|ユニクロ)[[:space:]　]*U([[:space:]　・:：/（）()]|$)'
  );

update public.clothing_items
set collection = 'UNIQLO : C'
where collection is null
  and (
    brand ~* '^(UNIQLO|ユニクロ)[[:space:]　]*[:：]?[[:space:]　]*C$'
    or name ~* '(UNIQLO|ユニクロ)[[:space:]　]*[:：]?[[:space:]　]*C([[:space:]　・/（）()]|$)'
  );

create index clothing_items_user_view_count_idx
  on public.clothing_items (user_id, view_count, created_at desc)
  where is_active;

-- Invoker rights retain the table's RLS policy. The owner predicate is an
-- additional guard, and the single UPDATE is atomic under concurrent opens.
create function public.increment_clothing_view_count(p_item_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_count integer;
begin
  update public.clothing_items
  set view_count = view_count + 1
  where id = p_item_id
    and user_id = (select auth.uid())
    and is_active
  returning view_count into next_count;

  if next_count is null then
    raise exception 'Clothing item not found' using errcode = 'P0002';
  end if;
  return next_count;
end;
$$;

revoke all on function public.increment_clothing_view_count(uuid) from public, anon;
grant execute on function public.increment_clothing_view_count(uuid) to authenticated;
