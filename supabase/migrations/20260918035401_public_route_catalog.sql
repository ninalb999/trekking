create or replace function public.public_route_catalog(
  search_text text default '',
  difficulty_filter text default null,
  limit_count integer default 25
)
returns table (
  id uuid,
  name text,
  description text,
  difficulty text,
  owner_name text,
  total_distance_m double precision,
  active_duration_seconds integer,
  pause_count integer,
  published_at timestamp with time zone,
  main_image_path text,
  equipment text[],
  point_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id,
    r.name,
    r.description,
    r.difficulty,
    coalesce(p.full_name, 'Explorador') as owner_name,
    r.total_distance_m,
    r.active_duration_seconds,
    r.pause_count,
    r.published_at,
    r.main_image_path,
    coalesce(eq.items, '{}'::text[]) as equipment,
    coalesce(points.total, 0)::integer as point_count
  from public.routes r
  left join public.profiles p on p.id = r.owner_id
  left join lateral (
    select array_agg(e.name order by e.name) as items
    from public.route_equipment e
    where e.route_id = r.id
  ) eq on true
  left join lateral (
    select count(*) as total
    from public.route_points rp
    where rp.route_id = r.id
  ) points on true
  where r.visibility = 'public'
    and r.status = 'published'
    and r.name is not null
    and (difficulty_filter is null or difficulty_filter = '' or r.difficulty = difficulty_filter)
    and (
      coalesce(search_text, '') = ''
      or r.name ilike '%' || search_text || '%'
      or coalesce(r.description, '') ilike '%' || search_text || '%'
      or coalesce(p.full_name, '') ilike '%' || search_text || '%'
    )
  order by r.published_at desc nulls last, r.updated_at desc
  limit greatest(1, least(coalesce(limit_count, 25), 50));
$$;

create or replace function public.public_route_detail(route_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'route', jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'description', r.description,
      'difficulty', r.difficulty,
      'ownerName', coalesce(p.full_name, 'Explorador'),
      'totalDistanceM', r.total_distance_m,
      'activeDurationSeconds', r.active_duration_seconds,
      'pauseCount', r.pause_count,
      'publishedAt', r.published_at,
      'mainImagePath', r.main_image_path
    ),
    'equipment', coalesce((
      select jsonb_agg(e.name order by e.name)
      from public.route_equipment e
      where e.route_id = r.id
    ), '[]'::jsonb),
    'track', coalesce((
      select jsonb_agg(jsonb_build_object(
        'latitude', t.latitude,
        'longitude', t.longitude,
        'accuracy', t.accuracy_m,
        'timestamp', extract(epoch from t.recorded_at) * 1000,
        'segment', t.segment_no
      ) order by t.sequence_no)
      from public.route_track_points t
      where t.route_id = r.id
    ), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rp.id,
        'name', rp.name,
        'description', rp.description,
        'type', rp.point_type,
        'latitude', rp.latitude,
        'longitude', rp.longitude,
        'services', coalesce((
          select jsonb_agg(rps.service_type order by rps.service_type)
          from public.route_point_services rps
          where rps.route_point_id = rp.id
        ), '[]'::jsonb)
      ) order by rp.sequence_no nulls last, rp.created_at)
      from public.route_points rp
      where rp.route_id = r.id
    ), '[]'::jsonb)
  )
  into result
  from public.routes r
  left join public.profiles p on p.id = r.owner_id
  where r.id = route_id
    and r.visibility = 'public'
    and r.status = 'published';

  return result;
end;
$$;

revoke all on function public.public_route_catalog(text, text, integer) from public, anon, authenticated;
grant execute on function public.public_route_catalog(text, text, integer) to anon, authenticated;

revoke all on function public.public_route_detail(uuid) from public, anon, authenticated;
grant execute on function public.public_route_detail(uuid) to anon, authenticated;
