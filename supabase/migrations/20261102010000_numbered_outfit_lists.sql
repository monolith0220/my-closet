-- Numbered outfit lists with category-aware layers.

alter table public.outfits
  add column list_number integer;

with numbered as (
  select
    id,
    row_number() over (partition by user_id order by created_at, id)::integer as list_number
  from public.outfits
)
update public.outfits as outfits
set list_number = numbered.list_number
from numbered
where outfits.id = numbered.id;

alter table public.outfits
  alter column list_number set not null,
  add constraint outfits_list_number_positive check (list_number > 0);

create unique index outfits_user_list_number_idx
  on public.outfits (user_id, list_number);

create function public.assign_outfit_list_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.list_number is null then
    -- Serialize numbering per user so two simultaneous additions cannot receive
    -- the same number.
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    select coalesce(max(outfit.list_number), 0) + 1
      into new.list_number
      from public.outfits as outfit
      where outfit.user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger outfits_assign_list_number
before insert on public.outfits
for each row execute function public.assign_outfit_list_number();

drop index if exists public.outfit_items_one_bottom_idx;
drop index if exists public.outfit_items_top_position_idx;

-- Existing generic tops become outer or inner layers from their saved category.
update public.outfit_items as link
set role = case
  when clothing.category_group = 'アウター' or clothing.category = 'アウター' then 'outer'
  else 'inner'
end
from public.clothing_items as clothing
where clothing.id = link.clothing_item_id
  and clothing.user_id = link.user_id
  and link.role in ('top', 'main');

-- Number each layer densely from zero so the UI can display アウター1,
-- インナー1 and so on, independently.
with ranked as (
  select
    id,
    (row_number() over (partition by outfit_id, role order by position, id) - 1)::integer as next_position
  from public.outfit_items
)
update public.outfit_items as link
set position = ranked.next_position
from ranked
where link.id = ranked.id;

alter table public.outfit_items
  alter column role set default 'inner',
  add constraint outfit_items_layer_role check (role in ('outer', 'inner', 'bottom')),
  add constraint outfit_items_bottom_position check (role <> 'bottom' or position = 0);

create unique index outfit_items_one_bottom_idx
  on public.outfit_items (outfit_id)
  where role = 'bottom';

create unique index outfit_items_layer_position_idx
  on public.outfit_items (outfit_id, role, position);
