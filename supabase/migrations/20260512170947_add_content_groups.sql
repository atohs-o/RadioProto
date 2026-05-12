-- ============================================================================
-- content_groups テーブル追加・既存 group_id FK 張り替え
-- ============================================================================

-- 1. content_groups テーブル作成
create table public.content_groups (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  description  text,
  tags         jsonb       not null default '[]',
  created_by   uuid        references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.content_groups is
  '音声コンテンツグループ。コンテンツを論理的にまとめ、ラジオ番組と紐づける';

-- 2. RLS（radio_programs と同じパターン: root ユーザーのみ全操作可）
alter table public.content_groups enable row level security;
create policy "content_groups_root_all" on public.content_groups
  for all using (public.is_root()) with check (public.is_root());

-- 3. contents.group_id の FK を groups → content_groups に張り替え
alter table public.contents drop constraint contents_group_id_fkey;
alter table public.contents
  add constraint contents_content_group_id_fkey
  foreign key (group_id) references public.content_groups(id) on delete set null;

-- 4. radio_programs.group_id の FK を張り替え
alter table public.radio_programs drop constraint radio_programs_group_id_fkey;
alter table public.radio_programs
  add constraint radio_programs_content_group_id_fkey
  foreign key (group_id) references public.content_groups(id) on delete set null;

-- 5. デフォルトグループを挿入し、既存 contents を紐づけ
do $$
declare default_id uuid;
begin
  insert into public.content_groups (name, description)
  values ('デフォルトグループ', '既存コンテンツの移行先')
  returning id into default_id;

  update public.contents set group_id = default_id where group_id is null;
end $$;
