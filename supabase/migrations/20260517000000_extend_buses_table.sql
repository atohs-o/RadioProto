-- buses テーブルにカラム追加
alter table public.buses
  add column plate_number       text,
  add column image_url          text,
  add column current_program_id uuid references public.radio_programs(id) on delete set null,
  add column manual_program_id  uuid references public.radio_programs(id) on delete set null,
  add column is_manual_override boolean not null default false;

-- Storage バケット 'buses' 新設（private）
insert into storage.buckets (id, name, public)
values ('buses', 'buses', false)
on conflict (id) do nothing;

-- Storage RLS（audio-files と同パターン）
create policy "buses_storage_root_all"
  on storage.objects for all
  to authenticated
  using  (bucket_id = 'buses' and public.is_root())
  with check (bucket_id = 'buses' and public.is_root());
