# Supabase スキーマ & RLS ポリシー仕様

> 対象マイグレーション: `supabase/migrations/20260501000000_initial_schema.sql`
> 機能仕様書との対応: `docs/functional_spec_v2.md` §7-1, §8, §10

---

## 1. テーブル設計

ユーザーが要求した概念（bus_routes / bus_stops / audio_contents / play_logs）と実際のテーブル名の対応:

| 概念名 | 実テーブル | 備考 |
|---|---|---|
| bus_routes | `routes` | `radio_programs` 経由でバスと紐づく |
| bus_stops | `route_stops` | `routes` の子テーブル |
| audio_contents | `contents` + `audio_files` | 台本と音声を分離 |
| play_logs | `trips` + `trip_playback_events` | 運行単位でイベント記録 |

---

### 1-1. `routes`（bus_routes 相当）

```sql
create table public.routes (
  id                 uuid          primary key default gen_random_uuid(),
  radio_program_id   uuid          not null references public.radio_programs(id),
  name               text,
  geometry           jsonb         not null,  -- [{lat, lng}, ...] 点列
  source             text          check (source in ('manual_click', 'csv_import', 'gtfs_import')),
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);
```

**設計ポイント:**

- バスと路線は直接 FK しない。`buses` → `bus_radio_assignments` → `radio_programs` → `routes` の経路
- 理由: 1台のバスが複数番組を切り替える Phase 2 対応のための正規化。MVP は 1バス=1番組=1路線
- `geometry` は PostGIS ではなく jsonb 点列。空間判定はクライアント側で Turf.js / ハヴァーサインを使用
- `source` により地図クリック・CSV インポート・GTFS インポートを区別（GTFS は Phase 2）

---

### 1-2. `route_stops`（bus_stops 相当）

```sql
create table public.route_stops (
  id          uuid          primary key default gen_random_uuid(),
  route_id    uuid          not null references public.routes(id) on delete cascade,
  sequence    integer       not null,
  name        text,
  lat         numeric(9, 6) not null,  -- 精度約11cm
  lng         numeric(9, 6) not null,
  created_at  timestamptz   not null default now()
);

create unique index route_stops_route_seq on public.route_stops(route_id, sequence);
```

**設計ポイント:**

- `sequence` で停留所の順序を管理（ハヴァーサイン距離判定と組み合わせて通過判定）
- GPS 平滑化（直近3点移動平均）は `src/lib/geo.ts` のクライアント側で実施（§9-7）
- `updated_at` なし。経路変更は route_stops を削除→再 INSERT で対応

---

### 1-3. `contents` + `audio_files`（audio_contents 相当）

```sql
-- 台本テキスト（source of truth）
create table public.contents (
  id                       uuid        primary key default gen_random_uuid(),
  title                    text        not null,
  script                   text        not null,       -- TTS 入力。≤4000 bytes 推奨
  summary                  text,
  source_type              text        not null
                           check (source_type in ('polling', 'manual', 'url', 'file')),
  source_url               text,
  source_polling_site_id   uuid        references public.polling_sites(id),
  category_tag             text,
  metadata                 jsonb       not null default '{}'::jsonb,
  group_id                 uuid        references public.groups(id),  -- Phase 2
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- TTS 生成済み音声ファイル
create table public.audio_files (
  id               uuid          primary key default gen_random_uuid(),
  content_id       uuid          not null references public.contents(id) on delete cascade,
  storage_path     text          not null,  -- audio-files バケット内のパス
  duration_seconds numeric(6, 2),
  tts_model        text,                   -- 環境変数 GEMINI_TTS_MODEL から記録
  metadata         jsonb         not null default '{}'::jsonb,
  created_at       timestamptz   not null default now()
);
```

**設計ポイント:**

- `contents` と `audio_files` を分離: 台本は即保存、音声は非同期 TTS 生成
- 1つの `contents` に複数の `audio_files` が紐づく可能性あり（再生成・失敗リトライ）
- `script` のバイト数バリデーションはアプリ層（API Route の zod スキーマ）で行う
- `storage_path` のアクセス: `audio-files` バケットは非公開。署名付き URL を API Route で発行

**`metadata` JSONB 許容フィールド（MVP）:**

| テーブル | 許容フィールド |
|---|---|
| `contents.metadata` | `{"source_fetched_at": "...", "raw_html_length": 0}` |
| `audio_files.metadata` | `{"chunk_index": 0, "generation_duration_ms": 0}` |

---

### 1-4. `trips` + `trip_playback_events`（play_logs 相当）

```sql
-- 1運行 = 1 trip
create table public.trips (
  id                uuid        primary key default gen_random_uuid(),
  bus_id            uuid        not null references public.buses(id),
  radio_program_id  uuid        references public.radio_programs(id),
  device_id         uuid        references public.devices(id),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

-- 再生イベント（永続フラグ禁止・イベント記録のみ）
create table public.trip_playback_events (
  id                       uuid          primary key default gen_random_uuid(),
  trip_id                  uuid          not null references public.trips(id) on delete cascade,
  radio_program_item_id    uuid          not null references public.radio_program_items(id),
  status                   text          not null
                           check (status in ('played', 'skipped', 'failed', 'cancelled')),
  played_at                timestamptz   not null default now(),
  duration_seconds         numeric(6, 2),
  metadata                 jsonb         not null default '{}'::jsonb,
  created_at               timestamptz   not null default now()
);
```

**設計ポイント:**

- **再生済みフラグ禁止**: `status='played'` のイベントが存在するかで判定する
- 運行ごとに新 trip を生成 → フラグリセット不要（構造的に正しい）
- 詳細は仕様書 §10-5「なぜ trips テーブルを最初から作るか」を参照

**`metadata` JSONB 許容フィールド（MVP）:**

| テーブル | 許容フィールド |
|---|---|
| `trips.metadata` | `{"driver_memo": "...", "notes": "..."}` のみ。乗客 PII 禁止 |
| `trip_playback_events.metadata` | `{}` 空。システム自動記録値のみ |

---

## 2. RLS ポリシー設計

### 2-1. MVP（実装済み）

```sql
-- ヘルパー関数（security definer で profiles を参照）
create function public.is_root()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'root'
  );
$$;

-- 全テーブルに同一パターンを適用
-- 対象: routes, route_stops, contents, audio_files,
--       trips, trip_playback_events, vehicle_location_logs, ...
create policy "{table}_root_all" on public.{table}
  for all
  using (public.is_root())
  with check (public.is_root());

-- Storage: audio-files バケット
create policy "audio_files_root_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'audio-files' and public.is_root())
  with check (bucket_id = 'audio-files' and public.is_root());
```

**車内クライアントのアクセス経路（RLS を経由しない）:**

```
車内タブレット
  ↓ デバイストークン付き HTTP リクエスト
Next.js API Route (/api/client/*)
  ↓ devices.token と照合 → bus_id 特定
  ↓ SUPABASE_SERVICE_ROLE_KEY で Supabase クエリ（RLS バイパス）
Supabase
```

- 車内クライアントには anon key を埋め込まない（API Route 経由のみ）
- 例外: Realtime broadcast は MVP では anon key を使用（broadcast は RLS 対象外）

### 2-2. Phase 2 設計（参考・未実装）

```sql
-- 追加ヘルパー
create function public.is_editor() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('root', 'editor'));
$$;

create function public.is_viewer() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('root', 'editor', 'viewer'));
$$;

-- contents / routes / route_stops: editor は CRUD、viewer は SELECT のみ
create policy "contents_editor_crud" on public.contents
  for all using (public.is_editor()) with check (public.is_editor());
create policy "contents_viewer_select" on public.contents
  for select using (public.is_viewer());

-- trips / trip_playback_events / vehicle_location_logs: PII のため root のみ維持
```

---

## 3. PII 取扱い方針

### 3-1. PII リスクがあるテーブル・カラム

| テーブル | カラム | PII リスク | 分類 |
|---|---|---|---|
| `trips` | `bus_id`, `device_id` | 特定車両・端末を識別 | 準個人情報 |
| `trips` | `started_at`, `ended_at` | 車両の運行時刻 | 準個人情報 |
| `trips` | `metadata` | 将来: 乗客数・ドライバーメモ等 | 要管理 |
| `vehicle_location_logs` | `lat`, `lng`, `recorded_at` | 精密 GPS（精度~11cm）+ 時刻 | 個人情報相当 |
| `trip_playback_events` | `metadata` | Phase 2: 乗客 ID 等含む可能性 | 要管理 |

### 3-2. MVP での PII 緩和策

1. **アクセス制限**: PII リスクのあるテーブルは RLS により root のみ参照可能
2. **API Route での非公開**: 車内クライアントに対して trips / playback の raw データは返さない
3. **metadata の JSONB 契約**: 乗客 PII を metadata に入れない（Phase 2 で `passenger_sessions` テーブルに分離）
4. **`vehicle_location_logs`**: 管理画面のみ参照（root）。30秒間引きで書き込み

### 3-3. Phase 2 での追加対策（参考）

- **データ保持期間**: `vehicle_location_logs` は90日後に自動削除（pg_cron または Edge Function）
- **集計ビュー**: raw lat/lng を見せず、停留所ベースの集計に変換したビューを editor に公開
- **乗客データ**: `passenger_users` / `passenger_sessions` は別 RLS グループで管理

---

## 4. アクセスパターン一覧

| 利用者 | テーブル | 操作 | 経路 |
|---|---|---|---|
| 管理者（root） | 全テーブル | CRUD | Supabase JS SDK（anon key + JWT）→ RLS `is_root()` |
| 車内クライアント | `routes`, `route_stops` | SELECT | API Route → Service Role |
| 車内クライアント | `radio_program_items` | SELECT | API Route → Service Role |
| 車内クライアント | `audio_files`（署名付き URL） | GET | API Route → Service Role で署名生成 |
| 車内クライアント | `trips` | INSERT（運行開始） | API Route → Service Role |
| 車内クライアント | `trip_playback_events` | INSERT | API Route → Service Role |
| Edge Function（定期） | `contents`, `polling_sites` | SELECT / INSERT | Service Role（Deno） |

---

## 5. 未実装・要確認事項

| 項目 | 状態 | 優先度 |
|---|---|---|
| `@supabase/supabase-js` を `package.json` に追加 | 未 | 高 |
| `src/lib/supabase.ts` 作成 | 未 | 高 |
| `supabase link --project-ref <ref>` でリンク | 未確認 | 高 |
| `pnpm gen:types` 実行（`database.types.ts` 生成） | 未 | 高 |
| `scripts/setup-root-user.ts` 作成 | 未 | 中 |
| データ保持期間の定義 | 未 | Phase 2 |
