-- Run after migrations with `supabase test db` against a local Supabase stack.
-- Seed rows as the test runner's privileged role, then exercise the actual client roles.
begin;

select plan(34);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'closet-owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'closet-other@example.test');

insert into public.clothing_items (id, user_id, name, brand, category, color) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Owner shirt', 'UNIQLO', 'tops', 'white'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', 'Other jacket', 'GU', 'outerwear', 'black');

insert into public.outfits (id, user_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'Owner outfit'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', 'Other outfit');

insert into public.outfit_items (id, outfit_id, clothing_item_id, user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222');

select ok((select relrowsecurity from pg_class where oid = 'public.clothing_items'::regclass), 'clothing_items has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.outfits'::regclass), 'outfits has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.outfit_items'::regclass), 'outfit_items has RLS');
select is((select public from storage.buckets where id = 'clothing-images'), false, 'image bucket is private');

set local role anon;
select throws_ok($$select * from public.clothing_items$$, '42501', null, 'signed-out user cannot read clothing');
select throws_ok($$select * from public.outfits$$, '42501', null, 'signed-out user cannot read outfits');
select throws_ok($$select * from public.outfit_items$$, '42501', null, 'signed-out user cannot read outfit items');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq($$select name from public.clothing_items$$, array['Owner shirt'], 'owner reads only their clothing');
select results_eq(
  $$insert into public.clothing_items (id, name, brand, category, color)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'New shirt', 'UNIQLO', 'tops', 'blue')
    returning name$$,
  array['New shirt'],
  'owner can add clothing using the auth.uid default'
);
select throws_ok(
  $$insert into public.clothing_items (user_id, name, brand, category, color)
    values ('22222222-2222-2222-2222-222222222222', 'Impersonated', 'GU', 'tops', 'red')$$,
  '42501', null, 'owner cannot insert clothing for another user'
);
select is_empty(
  $$update public.clothing_items set name = 'Stolen' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' returning id$$,
  'owner cannot update another user clothing'
);
select is_empty(
  $$delete from public.clothing_items where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' returning id$$,
  'owner cannot delete another user clothing'
);
select results_eq(
  $$update public.clothing_items set name = 'Edited shirt' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' returning name$$,
  array['Edited shirt'], 'owner can edit their clothing'
);
select throws_ok(
  $$update public.clothing_items set user_id = '22222222-2222-2222-2222-222222222222'
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$$,
  '42501', null, 'owner cannot transfer clothing into another account'
);

select results_eq($$select title from public.outfits$$, array['Owner outfit'], 'owner reads only their outfits');
select results_eq(
  $$insert into public.outfits (id, title)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'New outfit') returning title$$,
  array['New outfit'], 'owner can add an outfit'
);
select throws_ok(
  $$insert into public.outfits (user_id, title)
    values ('22222222-2222-2222-2222-222222222222', 'Impersonated outfit')$$,
  '42501', null, 'owner cannot insert an outfit for another user'
);
select is_empty(
  $$update public.outfits set title = 'Stolen' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2' returning id$$,
  'owner cannot update another user outfit'
);
select is_empty(
  $$delete from public.outfits where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2' returning id$$,
  'owner cannot delete another user outfit'
);

select results_eq($$select role from public.outfit_items$$, array['main'], 'owner reads only their outfit links');
select results_eq(
  $$insert into public.outfit_items (outfit_id, clothing_item_id, role)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'top')
    returning role$$,
  array['top'], 'owner can link their own clothing to their own outfit'
);
select throws_ok(
  $$insert into public.outfit_items (outfit_id, clothing_item_id, user_id)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'owner cannot create an outfit link for another user'
);
select throws_ok(
  $$insert into public.outfit_items (outfit_id, clothing_item_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')$$,
  '23503', null, 'composite foreign key rejects clothing owned by another user'
);
select is_empty(
  $$update public.outfit_items set role = 'stolen'
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3' returning id$$,
  'owner cannot update another user outfit link'
);
select is_empty(
  $$delete from public.outfit_items
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3' returning id$$,
  'owner cannot delete another user outfit link'
);

select results_eq(
  $$insert into storage.objects (bucket_id, name)
    values ('clothing-images', '11111111-1111-1111-1111-111111111111/photo.jpg')
    returning name$$,
  array['11111111-1111-1111-1111-111111111111/photo.jpg'],
  'owner can create an object in their own folder'
);
select results_eq(
  $$select name from storage.objects where bucket_id = 'clothing-images'$$,
  array['11111111-1111-1111-1111-111111111111/photo.jpg'],
  'owner can read their image'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('clothing-images', '22222222-2222-2222-2222-222222222222/stolen.jpg')$$,
  '42501', null, 'owner cannot upload into another user folder'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select results_eq($$select name from public.clothing_items$$, array['Other jacket'], 'second user reads only their clothing');
select is_empty(
  $$select * from public.outfits where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'$$,
  'second user cannot read first user outfit'
);
select is_empty(
  $$select * from storage.objects
    where bucket_id = 'clothing-images'
      and name = '11111111-1111-1111-1111-111111111111/photo.jpg'$$,
  'second user cannot read first user image'
);
select is_empty(
  $$update storage.objects set name = '22222222-2222-2222-2222-222222222222/stolen.jpg'
    where bucket_id = 'clothing-images'
      and name = '11111111-1111-1111-1111-111111111111/photo.jpg' returning name$$,
  'second user cannot move first user image'
);
-- Storage normally sets this internally when deleting through its API. Its
-- statement trigger blocks all direct SQL DELETEs without the flag, before
-- the RLS policy can be tested. The transaction rolls back the metadata row.
set local storage.allow_delete_query = 'true';
select is_empty(
  $$delete from storage.objects
    where bucket_id = 'clothing-images'
      and name = '11111111-1111-1111-1111-111111111111/photo.jpg' returning name$$,
  'second user cannot delete first user image'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$delete from storage.objects
    where bucket_id = 'clothing-images'
      and name = '11111111-1111-1111-1111-111111111111/photo.jpg' returning name$$,
  array['11111111-1111-1111-1111-111111111111/photo.jpg'],
  'owner can delete their image'
);

select * from finish();
rollback;
