-- My Closet: tenant-owned data and a private image bucket.

create table public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  brand text not null check (length(btrim(brand)) > 0),
  category text not null check (length(btrim(category)) > 0),
  color text not null check (length(btrim(color)) > 0),
  size text,
  seasons text[] not null default '{}',
  style_tags text[] not null default '{}',
  product_code text,
  product_url text,
  image_path text,
  registration_method text not null default 'manual',
  memo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clothing_items_image_owner check (
    image_path is null or split_part(image_path, '/', 1) = user_id::text
  ),
  unique (id, user_id)
);

create index clothing_items_user_created_idx
  on public.clothing_items (user_id, created_at desc);

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  occasion text,
  season text,
  style text,
  reason text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index outfits_user_created_idx
  on public.outfits (user_id, created_at desc);

create table public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null,
  clothing_item_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null default 'main',
  unique (outfit_id, clothing_item_id),
  constraint outfit_items_outfit_owner_fk
    foreign key (outfit_id, user_id)
    references public.outfits (id, user_id) on delete cascade,
  constraint outfit_items_clothing_owner_fk
    foreign key (clothing_item_id, user_id)
    references public.clothing_items (id, user_id) on delete cascade
);

create index outfit_items_user_idx on public.outfit_items (user_id);
create index outfit_items_clothing_idx on public.outfit_items (clothing_item_id);

alter table public.clothing_items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

-- Explicit grants keep signed-out visitors from reaching private tables.
revoke all on table public.clothing_items, public.outfits, public.outfit_items
  from anon, authenticated;
grant select, insert, update, delete
  on table public.clothing_items, public.outfits, public.outfit_items
  to authenticated;

create policy "clothing_items_select_own"
  on public.clothing_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "clothing_items_insert_own"
  on public.clothing_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "clothing_items_update_own"
  on public.clothing_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "clothing_items_delete_own"
  on public.clothing_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "outfits_select_own"
  on public.outfits for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "outfits_insert_own"
  on public.outfits for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "outfits_update_own"
  on public.outfits for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "outfits_delete_own"
  on public.outfits for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "outfit_items_select_own"
  on public.outfit_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "outfit_items_insert_own"
  on public.outfit_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "outfit_items_update_own"
  on public.outfit_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "outfit_items_delete_own"
  on public.outfit_items for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Object names must start with the signed-in user's UUID, e.g. <uid>/<uuid>.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clothing-images',
  'clothing-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "clothing_images_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clothing-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
create policy "clothing_images_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clothing-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name like '%/%'
  );
create policy "clothing_images_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'clothing-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
  )
  with check (
    bucket_id = 'clothing-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name like '%/%'
  );
create policy "clothing_images_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'clothing-images'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
