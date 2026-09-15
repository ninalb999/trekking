-- The bucket is PRIVATE. Existing data is preserved if the bucket already exists.
insert into storage.buckets (id, name, public)
values ('route-images', 'route-images', false)
on conflict (id) do update set public = false;

-- Malformed paths return NULL instead of failing UUID casts inside RLS.
create function private.route_image_route_id(object_name text)
returns uuid
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when object_name ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9]+$'
    then (storage.foldername(object_name))[1]::uuid
    else null
  end;
$$;
revoke all on function private.route_image_route_id(text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.route_image_route_id(text) to anon, authenticated;
-- private is NOT an exposed API schema; the two trigger functions remain non-callable.
-- Supabase owns storage.objects and enables its RLS; do not alter ownership/system tables.
create policy route_images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'route-images' and exists (
    select 1 from public.routes r where r.id = private.route_image_route_id(storage.objects.name)
  ));
create policy route_images_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'route-images' and exists (
    select 1 from public.routes r
    where r.id = private.route_image_route_id(storage.objects.name) and r.owner_id = (select auth.uid())
  ));
create policy route_images_update_own on storage.objects for update to authenticated
  using (bucket_id = 'route-images' and exists (
    select 1 from public.routes r
    where r.id = private.route_image_route_id(storage.objects.name) and r.owner_id = (select auth.uid())
  )) with check (bucket_id = 'route-images' and exists (
    select 1 from public.routes r
    where r.id = private.route_image_route_id(storage.objects.name) and r.owner_id = (select auth.uid())
  ));
create policy route_images_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'route-images' and exists (
    select 1 from public.routes r
    where r.id = private.route_image_route_id(storage.objects.name) and r.owner_id = (select auth.uid())
  ));
