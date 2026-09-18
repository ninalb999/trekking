-- One row per piece of equipment; no comma-separated lists.
create table public.route_equipment (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  name text not null,
  requirement_level text not null default 'required'
    check (requirement_level in ('required', 'recommended')),
  created_at timestamptz not null default now()
);
alter table public.route_equipment enable row level security;
create index route_equipment_route_id_idx on public.route_equipment (route_id);
