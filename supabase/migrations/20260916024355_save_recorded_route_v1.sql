alter table public.route_track_points add column if not exists segment_no integer not null default 0 check (segment_no >= 0);
alter table public.routes add column if not exists client_snapshot jsonb;
alter table public.routes add column if not exists client_updated_at bigint not null default 0;

create or replace function public.save_recorded_route_v1(payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  rid uuid := (payload->>'id')::uuid;
  uid uuid := auth.uid();
  p jsonb;
  place_id uuid;
  finished boolean := payload->>'status' = 'finished';
  image_path text := nullif(payload->>'imagePath','');
begin
  if uid is null then raise exception 'Inicia sesion para sincronizar.'; end if;
  if (payload->>'ownerId')::uuid is distinct from uid then raise exception 'Propietario incorrecto.'; end if;
  if jsonb_typeof(payload->'points') is distinct from 'array' or jsonb_typeof(payload->'places') is distinct from 'array' then raise exception 'Recorrido invalido.'; end if;
  if finished and (length(trim(coalesce(payload->>'name',''))) = 0 or jsonb_array_length(payload->'points') = 0) then raise exception 'La ruta necesita nombre y coordenadas.'; end if;
  if image_path is not null and split_part(image_path,'/',1) <> rid::text then raise exception 'Imagen incorrecta.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
  if exists(select 1 from public.routes where id=rid and owner_id=uid and client_updated_at > (payload->>'updatedAt')::bigint) then raise exception 'Hay una version mas reciente de esta ruta.'; end if;
  insert into public.routes(id,owner_id,name,description,difficulty,visibility,status,started_at,finished_at,published_at,
    total_distance_m,active_duration_seconds,pause_count,start_latitude,start_longitude,end_latitude,end_longitude,main_image_path,client_snapshot,client_updated_at)
  values(rid,uid,left(payload->>'name',100),left(payload->>'description',500),payload->>'difficulty',
    payload->>'visibility',case when not finished then 'recording' when payload->>'visibility'='public' then 'published' else 'draft' end,
    to_timestamp((payload->>'started')::double precision/1000),
    case when finished then to_timestamp((payload->>'ended')::double precision/1000) end,
    case when finished and payload->>'visibility'='public' then now() end,
    (payload->>'distance')::double precision,floor((payload->>'elapsed')::double precision/1000)::int,(payload->>'pauseCount')::int,
    (payload->'points'->0->>'latitude')::double precision,(payload->'points'->0->>'longitude')::double precision,
    (payload->'points'->-1->>'latitude')::double precision,(payload->'points'->-1->>'longitude')::double precision,
    image_path,payload - 'photo' - 'syncedAt',(payload->>'updatedAt')::bigint)
  on conflict(id) do update set name=excluded.name,description=excluded.description,difficulty=excluded.difficulty,
    visibility=excluded.visibility,status=excluded.status,finished_at=excluded.finished_at,published_at=excluded.published_at,
    total_distance_m=excluded.total_distance_m,active_duration_seconds=excluded.active_duration_seconds,pause_count=excluded.pause_count,
    start_latitude=excluded.start_latitude,start_longitude=excluded.start_longitude,end_latitude=excluded.end_latitude,end_longitude=excluded.end_longitude,
    main_image_path=coalesce(excluded.main_image_path,public.routes.main_image_path),client_snapshot=excluded.client_snapshot,
    client_updated_at=excluded.client_updated_at,updated_at=now();
  delete from public.route_track_points where route_id=rid;
  insert into public.route_track_points(route_id,sequence_no,latitude,longitude,accuracy_m,recorded_at,segment_no)
    select rid,(ord-1)::int,(pt->>'latitude')::double precision,(pt->>'longitude')::double precision,
    (pt->>'accuracy')::double precision,to_timestamp((pt->>'timestamp')::double precision/1000),(pt->>'segment')::int
    from jsonb_array_elements(payload->'points') with ordinality t(pt,ord);
  delete from public.route_point_services where route_point_id in(select id from public.route_points where route_id=rid);
  delete from public.route_points where route_id=rid;
  for p in select value from jsonb_array_elements(payload->'places') loop
    place_id := (p->>'id')::uuid;
    insert into public.route_points(id,route_id,point_type,name,description,latitude,longitude)
      values(place_id,rid,p->>'type',left(p->>'name',100),left(p->>'description',200),(p->>'latitude')::double precision,(p->>'longitude')::double precision);
    insert into public.route_point_services(route_point_id,service_type)
      select place_id,value from jsonb_array_elements_text(p->'services');
  end loop;
  delete from public.route_equipment where route_id=rid;
  insert into public.route_equipment(route_id,name) select rid,value from jsonb_array_elements_text(payload->'equipment');
  return rid;
end;
$$;
revoke all on function public.save_recorded_route_v1(jsonb) from public, anon;
grant execute on function public.save_recorded_route_v1(jsonb) to authenticated;
