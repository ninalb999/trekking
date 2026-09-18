-- Automatic GPS samples; always query ORDER BY sequence_no to reconstruct the polyline.
create table public.route_track_points (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  sequence_no integer not null check (sequence_no >= 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  altitude_m double precision,
  accuracy_m double precision check (accuracy_m >= 0 and accuracy_m < 'Infinity'::double precision),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint route_track_points_route_sequence_key unique (route_id, sequence_no)
);
alter table public.route_track_points enable row level security;
-- The UNIQUE constraint already creates the required (route_id, sequence_no) index.
