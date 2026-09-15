-- Recording -> draft -> published; visibility is independent of recording state.
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text,
  description text,
  difficulty text,
  estimated_duration_minutes integer,
  visibility text not null default 'private'
    check (visibility in ('public', 'private')),
  status text not null default 'recording'
    check (status in ('recording', 'draft', 'published')),
  main_image_path text,
  started_at timestamptz,
  finished_at timestamptz,
  published_at timestamptz,
  start_latitude double precision check (start_latitude between -90 and 90),
  start_longitude double precision check (start_longitude between -180 and 180),
  end_latitude double precision check (end_latitude between -90 and 90),
  end_longitude double precision check (end_longitude between -180 and 180),
  total_distance_m double precision not null default 0
    check (total_distance_m >= 0 and total_distance_m < 'Infinity'::double precision),
  active_duration_seconds integer not null default 0 check (active_duration_seconds >= 0),
  pause_count integer not null default 0 check (pause_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_estimated_duration_nonnegative check (estimated_duration_minutes >= 0),
  constraint routes_main_image_own_folder check (
    main_image_path is null or (
      split_part(main_image_path, '/', 1) = id::text
      and main_image_path ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9]+$'
    )
  )
);
alter table public.routes enable row level security;

create index routes_owner_id_idx on public.routes (owner_id);
create index routes_visibility_status_idx on public.routes (visibility, status);
create index routes_created_at_idx on public.routes (created_at desc);
create index routes_difficulty_idx on public.routes (difficulty);

create trigger routes_set_updated_at
before update on public.routes
for each row execute function private.set_updated_at();

comment on column public.routes.difficulty is
  'Flexible V1 text; no fixed scale or automatic difficulty algorithm.';
comment on column public.routes.main_image_path is
  'Private route-images object path: <route_id>/<uuid>.<extension>; never a URL.';
