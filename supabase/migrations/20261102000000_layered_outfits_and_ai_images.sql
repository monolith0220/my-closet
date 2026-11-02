-- Layered outfit tops and private cached AI outfit previews.

drop index if exists public.outfit_items_one_pair_role_idx;

alter table public.outfit_items
  add column position integer not null default 0,
  add constraint outfit_items_position_nonnegative check (position >= 0);

create unique index outfit_items_one_bottom_idx
  on public.outfit_items (outfit_id)
  where role = 'bottom';

create unique index outfit_items_top_position_idx
  on public.outfit_items (outfit_id, position)
  where role = 'top';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'outfit-images',
  'outfit-images',
  false,
  10485760,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "outfit_images_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'outfit-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
create policy "outfit_images_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'outfit-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name like '%/%'
  );
create policy "outfit_images_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'outfit-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
  )
  with check (
    bucket_id = 'outfit-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name like '%/%'
  );
create policy "outfit_images_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'outfit-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
