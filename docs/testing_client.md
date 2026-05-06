# 車内クライアント 動作確認手順

フェーズ6実装後のエンドツーエンド確認手順です。
ローカル Supabase（`http://localhost:54321`）または本番プロジェクトどちらでも使えます。

---

## 前提

- `supabase start` でローカル Supabase が起動済み
- `pnpm dev` で Next.js 開発サーバーが起動済み（`http://localhost:3000`）
- 管理者アカウント（root user）でダッシュボードにアクセスできる

ローカル Supabase Studio: `http://localhost:54323`

---

## Step 1: テストデータの準備（SQL）

Supabase Studio の **SQL Editor** で以下を順番に実行します。
すべて `service_role` 相当の権限で実行されるため RLS を気にせず INSERT できます。

### 1-1. バス・デバイスを作成

```sql
-- テスト用バスを作成
INSERT INTO public.buses (bus_code, name)
VALUES ('BUS_001', '安曇野北ルート1号車')
ON CONFLICT (bus_code) DO NOTHING;

-- バスの UUID を取得してデバイスとひも付け
WITH bus AS (
  SELECT id FROM public.buses WHERE bus_code = 'BUS_001'
)
INSERT INTO public.devices (bus_id, token, is_active)
SELECT id, 'test-device-token-azumino-001', true
FROM bus
ON CONFLICT DO NOTHING;
```

### 1-2. 番組・アイテムを作成

```sql
-- 番組を作成
INSERT INTO public.radio_programs (name, program_type, is_active)
VALUES ('安曇野北部ルート（テスト）', 'route_bus', true)
ON CONFLICT DO NOTHING;

-- バスと番組を紐づけ
WITH bus AS (
  SELECT id FROM public.buses WHERE bus_code = 'BUS_001'
),
program AS (
  SELECT id FROM public.radio_programs WHERE name = '安曇野北部ルート（テスト）'
)
INSERT INTO public.bus_radio_assignments (bus_id, radio_program_id, is_active)
SELECT bus.id, program.id, true
FROM bus, program
ON CONFLICT DO NOTHING;

-- コンテンツを作成（audio_file は Step 1-3 で紐づける）
INSERT INTO public.contents (title, script, source_type, summary)
VALUES (
  '安曇野わさび農場 秋の収穫祭',
  'みなさん、こんにちは。大王わさび農場からのお知らせです。10月15日から17日まで、秋の収穫祭を開催いたします。入場は無料です。新鮮なわさびソフトもぜひお試しください。',
  'manual',
  '10月15日〜17日開催。入場無料。'
)
ON CONFLICT DO NOTHING;

-- 番組アイテムを作成（穂高駅前、lat/lng は安曇野の実座標）
WITH program AS (
  SELECT id FROM public.radio_programs WHERE name = '安曇野北部ルート（テスト）'
),
content AS (
  SELECT id FROM public.contents WHERE title = '安曇野わさび農場 秋の収穫祭'
)
INSERT INTO public.radio_program_items (
  radio_program_id, content_id, lat, lng, display_name, sequence
)
SELECT program.id, content.id, 36.3006, 137.8729, '穂高駅前', 1
FROM program, content
ON CONFLICT DO NOTHING;
```

### 1-3. 音声ファイルの準備

音声ファイルのテストには2通りの方法があります。

#### 方法 A：管理画面で音声を生成（推奨）

1. `http://localhost:3000/contents` を開く
2. 「安曇野わさび農場 秋の収穫祭」の編集画面へ
3. 「音声生成」ボタンを実行し、生成完了を待つ
4. 生成後、`audio_files` テーブルに自動でレコードが作成される

#### 方法 B：ダミー音声ファイルを手動アップロード

1. テスト用 MP3 を用意（任意の短い音声ファイル）
2. Supabase Studio → **Storage** → `audio-files` バケットへアップロード
   - パス例：`contents/<content_id>/test.mp3`
3. 以下の SQL で `audio_files` レコードを INSERT

```sql
-- content_id と storage_path を実際の値に書き換えてから実行
WITH content AS (
  SELECT id FROM public.contents WHERE title = '安曇野わさび農場 秋の収穫祭'
)
INSERT INTO public.audio_files (content_id, storage_path, duration_seconds, tts_model)
SELECT
  content.id,
  'contents/' || content.id || '/test.mp3',  -- 実際のパスに書き換える
  90,
  'gemini-2.5-flash-tts'
FROM content;
```

4. 番組アイテムに audio_file_id を紐づける

```sql
UPDATE public.radio_program_items rpi
SET audio_file_id = (
  SELECT af.id
  FROM public.audio_files af
  JOIN public.contents c ON c.id = af.content_id
  WHERE c.title = '安曇野わさび農場 秋の収穫祭'
  LIMIT 1
)
WHERE rpi.display_name = '穂高駅前';
```

### 1-4. データ確認クエリ

```sql
-- セットアップが正しいか一括確認
SELECT
  b.bus_code,
  d.token,
  rp.name  AS program_name,
  rpi.display_name,
  rpi.lat,
  rpi.lng,
  af.storage_path,
  af.duration_seconds
FROM public.buses b
JOIN public.devices d ON d.bus_id = b.id
JOIN public.bus_radio_assignments bra ON bra.bus_id = b.id AND bra.is_active
JOIN public.radio_programs rp ON rp.id = bra.radio_program_id
JOIN public.radio_program_items rpi ON rpi.radio_program_id = rp.id
LEFT JOIN public.audio_files af ON af.id = rpi.audio_file_id
WHERE b.bus_code = 'BUS_001';
```

期待結果：`audio_files.storage_path` が NULL でなければ音声準備完了。

---

## Step 2: localStorage にデバイストークンをセット

Chrome / Safari の DevTools を開き、**Console** タブで以下を実行します。

```javascript
// デバイストークンをセット
localStorage.setItem('deviceToken', 'test-device-token-azumino-001')

// セットできたか確認
console.log(localStorage.getItem('deviceToken'))
// → 'test-device-token-azumino-001' が表示されれば OK
```

---

## Step 3: 番組選択 → 再生モードまでの確認

### 3-1. クライアントトップ（番組選択）

1. `http://localhost:3000/client` を開く
2. **期待動作**：
   - `deviceToken` あり → 番組一覧が表示される
   - 「安曇野北部ルート（テスト）」カードが表示される
3. **失敗パターン**：
   - `deviceToken` なし または DB に未登録 → `/client/setup`（未登録デバイス画面）へリダイレクトされる

### 3-2. 番組確認画面

1. 番組カードをタップ → `/client/confirm?programId=<id>` へ遷移
2. **確認項目**：
   - GPS ステータスが「受信中」になるか（DevTools Sensors で設定後、Step 4 参照）
   - サーバーステータスが「接続中」になるか（API が疎通しているか）
   - コンテンツ一覧に「穂高駅前 / 安曇野わさび農場 秋の収穫祭」が表示されるか
3. GPS・サーバー両方が OK になると「再生開始」ボタンが活性化する

### 3-3. 再生モード（メイン画面）

1. 「再生開始」→ `/client/play?programId=<id>` へ遷移
2. **確認項目**：
   - 地図が表示されるか（Leaflet）
   - GPS 受信中ステータスが表示されるか
   - ステータスバーに「再生中: ---」「待機中: 0件」が表示されるか
3. GPS 座標をアイテム位置（穂高駅前）に近づけると（Step 4 参照）：
   - 「待機中: 1件」→ 音声再生開始 → 「再生中: 安曇野わさび農場 秋の収穫祭」

### 3-4. 運行終了

1. 「運行終了」ボタン → 確認ダイアログ
2. 確認 → `/client` へ戻る
3. DB 確認：`trips.ended_at` が NULL でなくなっているか

```sql
SELECT id, bus_id, started_at, ended_at
FROM public.trips
ORDER BY started_at DESC
LIMIT 5;
```

---

## Step 4: DevTools Sensors で GPS 座標をモック

### 設定手順（Chrome）

1. DevTools を開く（F12）
2. 右上の `⋮` → **More tools** → **Sensors**（またはコマンドパレットで "Sensors"）
3. **Location** セクション → プルダウンから「**Other...**」を選択
4. 緯度・経度を手動入力

### 安曇野の座標サンプル

| 場所 | 緯度（Latitude） | 経度（Longitude） |
|---|---|---|
| 穂高駅前（アイテム位置） | `36.3006` | `137.8729` |
| 穂高駅前から 100m 北 | `36.3015` | `137.8729` |
| 穂高駅前から 5m（ほぼ一致） | `36.30065` | `137.87293` |
| 大王わさび農場 | `36.3234` | `137.8821` |
| 安曇野市役所 | `36.3012` | `137.9028` |

### GPS 接近テストの手順

1. DevTools Sensors で「穂高駅前から 100m 北」を設定
2. `/client/play` が開いている状態で確認 → 「待機中: 0件」のまま
3. Sensors で「穂高駅前から 5m」（`36.30065, 137.87293`）に変更
4. 数秒後（GPS 平滑化のため直近3点の平均が 10m 以内に入ると）→ キューに追加される

> **注意**：GPS 平滑化（直近3点の移動平均）が入っているため、座標を変えてもすぐには判定されません。
> 3〜5秒待ってから距離が縮まります。

### 精度シミュレーション

DevTools Sensors には **Accuracy** フィールドがあります。
- `10`（デフォルト）→ 通常 GPS 状態
- `150` 以上 → 低精度状態（ステータスが「精度低下」になるか確認）

---

## Step 5: 再生ログの確認

再生後、以下の SQL で記録を確認します。

```sql
-- 最新の運行と再生イベント
SELECT
  t.id         AS trip_id,
  t.started_at,
  t.ended_at,
  tpe.status,
  tpe.played_at,
  tpe.duration_seconds,
  rpi.display_name
FROM public.trips t
JOIN public.trip_playback_events tpe ON tpe.trip_id = t.id
JOIN public.radio_program_items rpi ON rpi.id = tpe.radio_program_item_id
ORDER BY t.started_at DESC, tpe.played_at DESC;
```

期待値：

| status | 意味 |
|---|---|
| `played` | 音声が最後まで再生された |
| `failed` | Audio API エラー |
| `cancelled` | 外部音声スイッチ ON で中断 |

```sql
-- GPS ログ（30秒間引き）
SELECT lat, lng, recorded_at
FROM public.vehicle_location_logs
ORDER BY recorded_at DESC
LIMIT 20;
```

---

## よくあるトラブル

| 症状 | 原因 | 対処 |
|---|---|---|
| 番組選択画面に何も表示されない | `bus_radio_assignments.is_active = false` または `radio_programs.is_active = false` | SQL で `is_active = true` を確認 |
| 番組確認画面でサーバーが「切断」のまま | API Route が `500` を返している | DevTools の Network タブで `/api/client/auth` のレスポンスを確認 |
| GPS が「未受信」のまま | DevTools Sensors の設定が反映されていない | ページをリロードしてから Sensors を設定 |
| 座標を近づけても再生されない | `audio_file_id` が NULL | Step 1-3 で audio_file の紐づけを確認 |
| 音声が再生されずエラー | 署名付き URL の取得失敗（Storage パスが存在しない） | Storage バケットにファイルが実際にアップロードされているか確認 |
| オフライン時に音声が再生されない | Service Worker が未登録またはキャッシュが空 | DevTools → Application → Service Workers で登録状態を確認 |

---

## テストデータのリセット

```sql
-- テストデータをまとめて削除（外部キー順に削除）
DELETE FROM public.trip_playback_events
WHERE trip_id IN (SELECT id FROM public.trips WHERE bus_id IN (SELECT id FROM public.buses WHERE bus_code = 'BUS_001'));

DELETE FROM public.vehicle_location_logs
WHERE bus_id IN (SELECT id FROM public.buses WHERE bus_code = 'BUS_001');

DELETE FROM public.trips
WHERE bus_id IN (SELECT id FROM public.buses WHERE bus_code = 'BUS_001');

DELETE FROM public.bus_radio_assignments
WHERE bus_id IN (SELECT id FROM public.buses WHERE bus_code = 'BUS_001');

DELETE FROM public.radio_program_items
WHERE radio_program_id IN (SELECT id FROM public.radio_programs WHERE name = '安曇野北部ルート（テスト）');

DELETE FROM public.radio_programs WHERE name = '安曇野北部ルート（テスト）';

DELETE FROM public.audio_files
WHERE content_id IN (SELECT id FROM public.contents WHERE title = '安曇野わさび農場 秋の収穫祭');

DELETE FROM public.contents WHERE title = '安曇野わさび農場 秋の収穫祭';

DELETE FROM public.devices
WHERE bus_id IN (SELECT id FROM public.buses WHERE bus_code = 'BUS_001');

DELETE FROM public.buses WHERE bus_code = 'BUS_001';
```
