-- ============================================================================
-- ファイル配置:supabase/migrations/20260501000000_initial_schema.sql
--
-- 適用方法:
--   1. ローカル:supabase db reset(全マイグレーション再適用)
--   2. リモート:supabase db push(差分のみ適用)
--   3. 適用後に必ず `pnpm gen:types` で型を再生成
--
-- ★ このファイルは適用済みになったら直接編集禁止(CLAUDE.md §10 参照)。
--   変更が必要な場合は新規 migration ファイルを `supabase migration new <name>` で作成する。
-- ============================================================================

-- ============================================================================
-- 初期スキーマ:モビリティ車内音声コンテンツシステム MVP
-- 仕様書 v2 rev4 準拠(docs/functional_spec_v2.md §8)
--
-- 設計原則(仕様書 §10-5, §11):
--   1. 永続フラグの代わりにイベント記録(trips + trip_playback_events)
--   2. MVP で使わないカラムも、Phase 2 追加が確実なものは最初から定義
--   3. テーブル単位の追加は後付けでも安価、カラム追加・意味変更は高価
--   4. 拡張余地は jsonb の settings / metadata カラムで先回り
--   5. PostGIS 不採用、座標は numeric(lat/lng)or jsonb(点列・ポリゴン)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 拡張機能
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ============================================================================
-- セクション 1:管理系
-- ============================================================================

-- ----------------------------------------------------------------------------
-- グループ(マルチテナント、MVP 未使用)
-- ----------------------------------------------------------------------------
create table public.groups (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.groups is
  'マルチテナント用グループ。MVP では未使用、Phase 2 で利用。group_id は各テーブルで NULL 許容';

-- ----------------------------------------------------------------------------
-- プロフィール(auth.users を拡張)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  role          text        not null default 'root'
                check (role in ('root', 'editor', 'viewer')),
  group_id      uuid        references public.groups(id) on delete set null,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'auth.users と1:1で紐づくプロフィール。仕様書では "users" と呼ばれているが Supabase 慣習で profiles に';
comment on column public.profiles.role is
  'MVP は root のみ。editor / viewer は Phase 2';

create index idx_profiles_group_id on public.profiles(group_id);

-- ----------------------------------------------------------------------------
-- グループメンバー(Phase 2 でグループ運用時に使う、MVP 未使用)
-- ----------------------------------------------------------------------------
create table public.group_members (
  group_id    uuid        not null references public.groups(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  role        text        not null default 'editor'
              check (role in ('editor', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

comment on table public.group_members is 'Phase 2 用。MVP では未使用';

-- ----------------------------------------------------------------------------
-- バス(車両)マスタ
-- ----------------------------------------------------------------------------
create table public.buses (
  id          uuid        primary key default gen_random_uuid(),
  bus_code    text        not null unique,
  qr_code_id  uuid        not null default gen_random_uuid() unique,
  name        text,
  group_id    uuid        references public.groups(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.buses.bus_code is
  '人間可読なバス識別子(例: BUS_001)。URL パラメータ ?bus=BUS_001 で使用';
comment on column public.buses.qr_code_id is
  'QR コード印刷時の不変 ID。MVP は未使用、Phase 2 で QR スキャンに使用';

create index idx_buses_group_id on public.buses(group_id);

-- ----------------------------------------------------------------------------
-- 車内クライアント用デバイストークン
-- ----------------------------------------------------------------------------
create table public.devices (
  id            uuid        primary key default gen_random_uuid(),
  bus_id        uuid        not null references public.buses(id) on delete cascade,
  token         text        not null unique,
  is_active     boolean     not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.devices is
  '車内タブレットの認証トークン。ブラウザ localStorage に保存、紛失時は is_active=false で無効化';

create index idx_devices_token  on public.devices(token) where is_active;
create index idx_devices_bus_id on public.devices(bus_id);

-- ============================================================================
-- セクション 2:コンテンツ系
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ポーリング対象サイト
-- ----------------------------------------------------------------------------
create table public.polling_sites (
  id              uuid        primary key default gen_random_uuid(),
  url             text        not null,
  name            text        not null,
  is_active       boolean     not null default true,
  settings        jsonb       not null default '{}'::jsonb,
  last_polled_at  timestamptz,
  last_status     text        check (last_status in ('success', 'failure', 'pending')),
  last_error      text,
  group_id        uuid        references public.groups(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.polling_sites.settings is
  '頻度・条件等の将来拡張用 JSONB。MVP では固定値(1日3回)で settings は未使用';
comment on column public.polling_sites.last_status is
  '直近ポーリング結果。SHOULD 機能の信頼性アピール表示で使用(仕様書 §11)';

create index idx_polling_sites_active on public.polling_sites(is_active) where is_active;

-- ----------------------------------------------------------------------------
-- コンテンツ(台本)
-- ----------------------------------------------------------------------------
create table public.contents (
  id                       uuid        primary key default gen_random_uuid(),
  title                    text        not null,
  script                   text        not null,
  summary                  text,
  source_type              text        not null
                           check (source_type in ('polling', 'manual', 'url', 'file')),
  source_url               text,
  source_polling_site_id   uuid        references public.polling_sites(id) on delete set null,
  category_tag             text,
  metadata                 jsonb       not null default '{}'::jsonb,
  group_id                 uuid        references public.groups(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.contents is
  '台本テキストとメタデータ。AI 生成後もユーザーが手で編集可能(仕様書 §3-1)';
comment on column public.contents.script is
  'TTS 入力用の台本テキスト。約4000バイト以内推奨(Vertex AI gemini-2.5-flash-tts 制約)';
comment on column public.contents.source_type is
  'MVP は polling / manual。url / file は COULD / Phase 2 だが値域は最初から定義';

create index idx_contents_source_type on public.contents(source_type);
create index idx_contents_created_at  on public.contents(created_at desc);
create index idx_contents_group_id    on public.contents(group_id);

-- ----------------------------------------------------------------------------
-- 音声ファイル
-- ----------------------------------------------------------------------------
create table public.audio_files (
  id                uuid        primary key default gen_random_uuid(),
  content_id        uuid        not null references public.contents(id) on delete cascade,
  storage_path      text        not null,
  duration_seconds  numeric(6, 2),
  file_size_bytes   integer,
  tts_model         text,
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

comment on column public.audio_files.storage_path is
  'Supabase Storage の audio-files バケット内のパス';
comment on column public.audio_files.tts_model is
  '生成に使ったモデル名(例: gemini-2.5-flash-tts)。差替時の追跡用';

create index idx_audio_files_content_id on public.audio_files(content_id);

-- ----------------------------------------------------------------------------
-- ラジオ番組
-- ----------------------------------------------------------------------------
create table public.radio_programs (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  program_type  text        not null default 'route_bus'
                check (program_type in ('route_bus', 'on_demand')),
  is_active     boolean     not null default true,
  group_id      uuid        references public.groups(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.radio_programs.program_type is
  'MVP は route_bus のみ実装、on_demand は Phase 2(値域は最初から定義、仕様書 §10-5)';

create index idx_radio_programs_group_id on public.radio_programs(group_id);

-- ----------------------------------------------------------------------------
-- 路線(路線バス型番組用)
-- ----------------------------------------------------------------------------
create table public.routes (
  id                 uuid        primary key default gen_random_uuid(),
  radio_program_id   uuid        not null references public.radio_programs(id) on delete cascade,
  name               text,
  geometry           jsonb       not null,
  source             text        check (source in ('manual_click', 'csv_import', 'gtfs_import')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column public.routes.geometry is
  '[{"lat": ..., "lng": ...}, ...] 形式の点列 JSONB。PostGIS 不採用(仕様書 §10-3)';
comment on column public.routes.source is
  'gtfs_import は Phase 2、MVP は manual_click / csv_import';

create index idx_routes_radio_program_id on public.routes(radio_program_id);

-- ----------------------------------------------------------------------------
-- 路線停留所(路線バス型のシーケンス、Phase 2 で GTFS 連携時に活用)
-- ----------------------------------------------------------------------------
create table public.route_stops (
  id          uuid          primary key default gen_random_uuid(),
  route_id    uuid          not null references public.routes(id) on delete cascade,
  sequence    integer       not null,
  name        text,
  lat         numeric(9, 6) not null,
  lng         numeric(9, 6) not null,
  created_at  timestamptz   not null default now()
);

create unique index idx_route_stops_route_sequence on public.route_stops(route_id, sequence);

-- ----------------------------------------------------------------------------
-- ラジオ番組の再生アイテム(番組 × 位置 × 音声)
-- ----------------------------------------------------------------------------
create table public.radio_program_items (
  id                 uuid          primary key default gen_random_uuid(),
  radio_program_id   uuid          not null references public.radio_programs(id) on delete cascade,
  content_id         uuid          not null references public.contents(id) on delete restrict,
  audio_file_id      uuid          references public.audio_files(id) on delete set null,
  lat                numeric(9, 6) not null,
  lng                numeric(9, 6) not null,
  sequence           integer,
  display_name       text,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

comment on table public.radio_program_items is
  '★ 再生済みフラグは持たない。再生履歴は trip_playback_events で管理(仕様書 §10-5)';
comment on column public.radio_program_items.sequence is
  '路線バス型での再生順。on_demand 型では NULL';

create index idx_radio_program_items_program on public.radio_program_items(radio_program_id);
create unique index idx_radio_program_items_sequence
  on public.radio_program_items(radio_program_id, sequence)
  where sequence is not null;

-- ----------------------------------------------------------------------------
-- オンデマンドエリア(Phase 2、スキーマのみ)
-- ----------------------------------------------------------------------------
create table public.ondemand_areas (
  id                  uuid        primary key default gen_random_uuid(),
  radio_program_id    uuid        not null references public.radio_programs(id) on delete cascade,
  polygon             jsonb       not null,
  proximity_settings  jsonb       not null default '{"radius_m": 200}'::jsonb,
  created_at          timestamptz not null default now()
);

comment on table public.ondemand_areas is 'Phase 2 用。MVP では未使用';
comment on column public.ondemand_areas.polygon is
  '[{"lat": ..., "lng": ...}, ...] 形式のポリゴン JSONB';
comment on column public.ondemand_areas.proximity_settings is
  '{ radius_m: number, fan_angle_deg?: number }';

-- ----------------------------------------------------------------------------
-- バス × ラジオ番組の対応
-- ----------------------------------------------------------------------------
create table public.bus_radio_assignments (
  id                uuid        primary key default gen_random_uuid(),
  bus_id            uuid        not null references public.buses(id) on delete cascade,
  radio_program_id  uuid        not null references public.radio_programs(id) on delete cascade,
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.bus_radio_assignments is
  '1台のバスに対しアクティブな番組は1つまで(部分ユニークインデックスで強制)';

-- 同一バスでアクティブ割当は1つまで
create unique index idx_bus_radio_assignments_active_per_bus
  on public.bus_radio_assignments(bus_id) where is_active;

-- ============================================================================
-- セクション 3:運行記録系(MVP の核、仕様書 §10-5)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 運行(trip)
-- ----------------------------------------------------------------------------
create table public.trips (
  id                uuid        primary key default gen_random_uuid(),
  bus_id            uuid        not null references public.buses(id) on delete cascade,
  radio_program_id  uuid        not null references public.radio_programs(id) on delete cascade,
  device_id         uuid        references public.devices(id) on delete set null,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

comment on table public.trips is
  '★ 1運行 = 1 trip。再生履歴は trip 単位で記録、運行ごとに自動リセットされる(仕様書 §10-5)';

create index idx_trips_bus_id     on public.trips(bus_id);
create index idx_trips_started_at on public.trips(started_at desc);

-- ----------------------------------------------------------------------------
-- 再生イベント(再生済み・スキップ・失敗)
-- ----------------------------------------------------------------------------
create table public.trip_playback_events (
  id                       uuid        primary key default gen_random_uuid(),
  trip_id                  uuid        not null references public.trips(id) on delete cascade,
  radio_program_item_id    uuid        not null references public.radio_program_items(id) on delete cascade,
  status                   text        not null
                           check (status in ('played', 'skipped', 'failed', 'cancelled')),
  played_at                timestamptz not null default now(),
  duration_seconds         numeric(6, 2),
  metadata                 jsonb       not null default '{}'::jsonb,
  created_at               timestamptz not null default now()
);

comment on column public.trip_playback_events.status is
  'played: 完了 / skipped: 通過(範囲外) / failed: 再生失敗 / cancelled: 外部音声等で中断';
comment on column public.trip_playback_events.duration_seconds is
  '実再生秒数。中断時は途中までの長さ';

create index idx_trip_playback_events_trip on public.trip_playback_events(trip_id);
create index idx_trip_playback_events_item on public.trip_playback_events(radio_program_item_id);

-- ----------------------------------------------------------------------------
-- 軌跡ログ(30秒間引き、仕様書 §5-7)
-- ----------------------------------------------------------------------------
create table public.vehicle_location_logs (
  id           uuid          primary key default gen_random_uuid(),
  trip_id      uuid          references public.trips(id) on delete cascade,
  bus_id       uuid          not null references public.buses(id) on delete cascade,
  lat          numeric(9, 6) not null,
  lng          numeric(9, 6) not null,
  heading      numeric(5, 2),
  speed_kmh    numeric(5, 2),
  recorded_at  timestamptz   not null default now()
);

comment on table public.vehicle_location_logs is
  '30秒間隔の軌跡永続化。ライブ位置は Realtime broadcast で別系統(仕様書 §5-7)';

create index idx_vehicle_location_logs_trip     on public.vehicle_location_logs(trip_id);
create index idx_vehicle_location_logs_recorded on public.vehicle_location_logs(recorded_at desc);

-- ============================================================================
-- セクション 4:乗客系(Phase 2、スキーマのみ定義)
-- ============================================================================

create table public.passenger_users (
  id            uuid        primary key references auth.users(id) on delete cascade,
  display_name  text,
  preferences   jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.passenger_sessions (
  id                  uuid        primary key default gen_random_uuid(),
  passenger_user_id   uuid        not null references public.passenger_users(id) on delete cascade,
  content_id          uuid        references public.contents(id) on delete set null,
  bus_id              uuid        references public.buses(id) on delete set null,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_passenger_sessions_user on public.passenger_sessions(passenger_user_id);

create table public.passenger_session_messages (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references public.passenger_sessions(id) on delete cascade,
  role        text        not null check (role in ('user', 'assistant')),
  content     text        not null,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index idx_passenger_session_messages_session
  on public.passenger_session_messages(session_id);

create table public.passenger_favorites (
  id                 uuid        primary key default gen_random_uuid(),
  passenger_user_id  uuid        not null references public.passenger_users(id) on delete cascade,
  content_id         uuid        not null references public.contents(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (passenger_user_id, content_id)
);

-- ============================================================================
-- セクション 5:updated_at 自動更新トリガー
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- updated_at カラムを持つ全テーブルに一括適用
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
  loop
    execute format(
      'create trigger trg_%I_set_updated_at
       before update on public.%I
       for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================================
-- セクション 6:Storage バケット
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('audio-files', 'audio-files', false)
on conflict (id) do nothing;

-- comment on column storage.buckets.public is
--  'audio-files は非公開。署名付き URL で配信(乗客向け視聴は Phase 2 で要設計)';

-- ============================================================================
-- セクション 7:RLS(Row Level Security)
--
-- MVP 方針:
--   - 認証済み root ユーザーは全テーブル read/write 可
--   - サービスロール(Edge Functions / API Route)は RLS バイパス(Supabase 標準)
--   - 車内クライアントはデバイストークン認証経由で読み書き(別途エンドポイント経由)
--   - Phase 2 で role / group_id ベースの細粒度ポリシーに分割
-- ============================================================================

-- 全テーブルで RLS 有効化
alter table public.groups                      enable row level security;
alter table public.profiles                    enable row level security;
alter table public.group_members               enable row level security;
alter table public.buses                       enable row level security;
alter table public.devices                     enable row level security;
alter table public.bus_radio_assignments       enable row level security;
alter table public.polling_sites               enable row level security;
alter table public.contents                    enable row level security;
alter table public.audio_files                 enable row level security;
alter table public.radio_programs              enable row level security;
alter table public.routes                      enable row level security;
alter table public.route_stops                 enable row level security;
alter table public.radio_program_items         enable row level security;
alter table public.ondemand_areas              enable row level security;
alter table public.trips                       enable row level security;
alter table public.trip_playback_events        enable row level security;
alter table public.vehicle_location_logs       enable row level security;
alter table public.passenger_users             enable row level security;
alter table public.passenger_sessions          enable row level security;
alter table public.passenger_session_messages  enable row level security;
alter table public.passenger_favorites         enable row level security;

-- ----------------------------------------------------------------------------
-- ヘルパー関数:現在のユーザーが root か
-- ----------------------------------------------------------------------------
create or replace function public.is_root()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'root'
  );
$$;

comment on function public.is_root is
  'RLS ポリシー判定用。Phase 2 で is_editor / is_viewer 等を追加';

-- ----------------------------------------------------------------------------
-- profiles:自分のプロフィールは読める、root は全アクセス
-- ----------------------------------------------------------------------------
create policy "profiles_self_read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_root_all"
  on public.profiles for all
  using (public.is_root())
  with check (public.is_root());

-- ----------------------------------------------------------------------------
-- 管理系・コンテンツ系・運行記録系:root は全アクセス
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  table_list text[] := array[
    'groups', 'group_members', 'buses', 'devices',
    'bus_radio_assignments', 'polling_sites', 'contents', 'audio_files',
    'radio_programs', 'routes', 'route_stops', 'radio_program_items',
    'ondemand_areas', 'trips', 'trip_playback_events', 'vehicle_location_logs'
  ];
begin
  foreach t in array table_list loop
    execute format(
      'create policy "%I_root_all" on public.%I for all
       using (public.is_root()) with check (public.is_root())',
      t, t
    );
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 乗客系:Phase 2 で詰める。MVP は root のみアクセス可
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  table_list text[] := array[
    'passenger_users', 'passenger_sessions',
    'passenger_session_messages', 'passenger_favorites'
  ];
begin
  foreach t in array table_list loop
    execute format(
      'create policy "%I_root_all" on public.%I for all
       using (public.is_root()) with check (public.is_root())',
      t, t
    );
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Storage:audio-files バケットの RLS
-- ----------------------------------------------------------------------------
create policy "audio_files_root_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'audio-files' and public.is_root())
  with check (bucket_id = 'audio-files' and public.is_root());

-- ============================================================================
-- セクション 8:プロフィール自動作成トリガー
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'root')  -- MVP 唯一のユーザー想定で root を付与
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user is
  'auth.users 作成時に profiles を自動生成。MVP は role=root を付与、Phase 2 で招待制に変更';

-- ============================================================================
-- 完了
-- ============================================================================
