-- Open pause: ended_at/duration_seconds NULL. Close it when recording resumes.
create table public.route_pauses (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  constraint route_pauses_time_order check (ended_at is null or ended_at >= started_at)
);
alter table public.route_pauses enable row level security;
create index route_pauses_route_id_idx on public.route_pauses (route_id);
