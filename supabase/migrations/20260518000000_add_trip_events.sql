create table public.trip_events (
  id           uuid        primary key default gen_random_uuid(),
  trip_id      uuid        not null references public.trips(id) on delete cascade,
  event_type   text        not null
               check (event_type in (
                 'gps_lost','gps_recovered','server_lost','server_recovered',
                 'auth_failed','trip_started','trip_ended','abnormal_ended',
                 'timeout_ended','sequence_advanced','playback_error','location_update'
               )),
  metadata     jsonb        not null default '{}'::jsonb,
  occurred_at  timestamptz  not null default now()
);

create index idx_trip_events_trip_id on public.trip_events(trip_id);
create index idx_trip_events_occurred_at on public.trip_events(occurred_at desc);

alter table public.trip_events enable row level security;

create policy "trip_events_root_all"
  on public.trip_events for all
  using (public.is_root())
  with check (public.is_root());
