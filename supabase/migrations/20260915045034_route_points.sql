-- User-marked places are independent of automatic GPS samples.
create table public.route_points (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  point_type text not null check (point_type in ('campamento', 'descanso', 'agua', 'tienda', 'otro')),
  name text,
  description text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  sequence_no integer check (sequence_no >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.route_points enable row level security;
create index route_points_route_id_idx on public.route_points (route_id);

create trigger route_points_set_updated_at
before update on public.route_points
for each row execute function private.set_updated_at();

create table public.route_point_services (
  id uuid primary key default gen_random_uuid(),
  route_point_id uuid not null references public.route_points(id) on delete cascade,
  service_type text not null check (service_type in ('water', 'signal', 'lodging', 'shop')),
  is_available boolean not null default true,
  details text,
  created_at timestamptz not null default now(),
  constraint route_point_services_point_type_key unique (route_point_id, service_type)
);
alter table public.route_point_services enable row level security;
-- The UNIQUE index also covers lookups by route_point_id.
