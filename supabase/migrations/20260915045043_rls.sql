-- RLS has been enabled at creation, so no intermediate migration exposes rows.
-- Explicit grants work with both old and new Supabase Data API defaults.
grant usage on schema public to anon, authenticated;
revoke all on public.profiles, public.routes, public.route_track_points,
  public.route_points, public.route_point_services, public.route_equipment,
  public.route_pauses from public, anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update (full_name, avatar_path) on public.profiles to authenticated;

create policy profiles_read_basic on public.profiles for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.routes to anon, authenticated;
grant insert, update, delete on public.routes to authenticated;

create policy routes_read on public.routes for select to anon, authenticated
  using ((visibility = 'public' and status = 'published') or owner_id = (select auth.uid()));
create policy routes_insert_own on public.routes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy routes_update_own on public.routes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy routes_delete_own on public.routes for delete to authenticated
  using (owner_id = (select auth.uid()));

grant select on public.route_track_points to anon, authenticated;
grant insert, update, delete on public.route_track_points to authenticated;
create policy route_track_points_read on public.route_track_points for select
  to anon, authenticated using (exists (select 1 from public.routes r where r.id = route_track_points.route_id));
create policy route_track_points_insert_own on public.route_track_points for insert to authenticated
  with check (exists (select 1 from public.routes r where r.id = route_track_points.route_id and r.owner_id = (select auth.uid())));
create policy route_track_points_update_own on public.route_track_points for update to authenticated
  using (exists (select 1 from public.routes r where r.id = route_track_points.route_id and r.owner_id = (select auth.uid()))) with check (exists (select 1 from public.routes r where r.id = route_track_points.route_id and r.owner_id = (select auth.uid())));
create policy route_track_points_delete_own on public.route_track_points for delete to authenticated
  using (exists (select 1 from public.routes r where r.id = route_track_points.route_id and r.owner_id = (select auth.uid())));

grant select on public.route_points to anon, authenticated;
grant insert, update, delete on public.route_points to authenticated;
create policy route_points_read on public.route_points for select
  to anon, authenticated using (exists (select 1 from public.routes r where r.id = route_points.route_id));
create policy route_points_insert_own on public.route_points for insert to authenticated
  with check (exists (select 1 from public.routes r where r.id = route_points.route_id and r.owner_id = (select auth.uid())));
create policy route_points_update_own on public.route_points for update to authenticated
  using (exists (select 1 from public.routes r where r.id = route_points.route_id and r.owner_id = (select auth.uid()))) with check (exists (select 1 from public.routes r where r.id = route_points.route_id and r.owner_id = (select auth.uid())));
create policy route_points_delete_own on public.route_points for delete to authenticated
  using (exists (select 1 from public.routes r where r.id = route_points.route_id and r.owner_id = (select auth.uid())));

grant select on public.route_point_services to anon, authenticated;
grant insert, update, delete on public.route_point_services to authenticated;
create policy route_point_services_read on public.route_point_services for select
  to anon, authenticated using (exists (select 1 from public.route_points p join public.routes r on r.id = p.route_id
    where p.id = route_point_services.route_point_id));
create policy route_point_services_insert_own on public.route_point_services for insert to authenticated
  with check (exists (select 1 from public.route_points p join public.routes r on r.id = p.route_id
    where p.id = route_point_services.route_point_id and r.owner_id = (select auth.uid())));
create policy route_point_services_update_own on public.route_point_services for update to authenticated
  using (exists (select 1 from public.route_points p join public.routes r on r.id = p.route_id
    where p.id = route_point_services.route_point_id and r.owner_id = (select auth.uid()))) with check (exists (select 1 from public.route_points p join public.routes r on r.id = p.route_id
    where p.id = route_point_services.route_point_id and r.owner_id = (select auth.uid())));
create policy route_point_services_delete_own on public.route_point_services for delete to authenticated
  using (exists (select 1 from public.route_points p join public.routes r on r.id = p.route_id
    where p.id = route_point_services.route_point_id and r.owner_id = (select auth.uid())));

grant select on public.route_equipment to anon, authenticated;
grant insert, update, delete on public.route_equipment to authenticated;
create policy route_equipment_read on public.route_equipment for select
  to anon, authenticated using (exists (select 1 from public.routes r where r.id = route_equipment.route_id));
create policy route_equipment_insert_own on public.route_equipment for insert to authenticated
  with check (exists (select 1 from public.routes r where r.id = route_equipment.route_id and r.owner_id = (select auth.uid())));
create policy route_equipment_update_own on public.route_equipment for update to authenticated
  using (exists (select 1 from public.routes r where r.id = route_equipment.route_id and r.owner_id = (select auth.uid()))) with check (exists (select 1 from public.routes r where r.id = route_equipment.route_id and r.owner_id = (select auth.uid())));
create policy route_equipment_delete_own on public.route_equipment for delete to authenticated
  using (exists (select 1 from public.routes r where r.id = route_equipment.route_id and r.owner_id = (select auth.uid())));

grant select on public.route_pauses to authenticated;
grant insert, update, delete on public.route_pauses to authenticated;
create policy route_pauses_read on public.route_pauses for select
  to authenticated using (exists (select 1 from public.routes r where r.id = route_pauses.route_id and r.owner_id = (select auth.uid())));
create policy route_pauses_insert_own on public.route_pauses for insert to authenticated
  with check (exists (select 1 from public.routes r where r.id = route_pauses.route_id and r.owner_id = (select auth.uid())));
create policy route_pauses_update_own on public.route_pauses for update to authenticated
  using (exists (select 1 from public.routes r where r.id = route_pauses.route_id and r.owner_id = (select auth.uid()))) with check (exists (select 1 from public.routes r where r.id = route_pauses.route_id and r.owner_id = (select auth.uid())));
create policy route_pauses_delete_own on public.route_pauses for delete to authenticated
  using (exists (select 1 from public.routes r where r.id = route_pauses.route_id and r.owner_id = (select auth.uid())));
