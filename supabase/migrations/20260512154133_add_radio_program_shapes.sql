create table public.radio_program_shapes (
  id         uuid        primary key default gen_random_uuid(),
  program_id uuid        not null references public.radio_programs(id) on delete cascade,
  shape_id   text        not null,
  points     jsonb       not null,
  created_at timestamptz default now()
);

alter table public.radio_program_shapes enable row level security;

create policy "radio_program_shapes_root_all"
  on public.radio_program_shapes for all
  using (public.is_root()) with check (public.is_root());
