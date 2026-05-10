# 実装進捗状況（フェーズ7 → フェーズ8）

最終更新: 2026-05-10（フェーズ8: sequence 管理・音声タイムアウト実装後）

前回ステータス: `docs/implementation_status_20260506.md`（フェーズ1〜6 完了時点）

---

## 実装済みサマリ

| 領域 | 状態 | 備考 |
|---|---|---|
| DB スキーマ（全テーブル・RLS・トリガー） | ✅ 完了 | 前回から変更なし |
| ポーリングバッチ（Edge Function + pg_cron） | ✅ 完了 | 前回から変更なし |
| ping-keep-alive（auto-pause 対策） | ✅ 完了 | 前回から変更なし |
| ポーリングサイト管理 CRUD | ✅ 完了 | 前回から変更なし |
| コンテンツ管理 CRUD + AI 台本化 | ✅ 完了 | 前回から変更なし |
| TTS 音声生成・音声ファイル管理 | ✅ 完了 | 前回から変更なし |
| ラジオ番組管理 CRUD + 地図 UI | ✅ 完了 | 前回から変更なし |
| 車内クライアント（認証・番組選択・確認・再生） | ✅ 完了 | 前回から変更なし |
| ハヴァーサイン距離判定 + GPS 平滑化 | ✅ 完了 | 前回から変更なし |
| Cache API プリキャッシュ + Service Worker | ✅ 完了 | 前回から変更なし |
| Realtime broadcast（位置送信） | ✅ 完了 | heading/speed を追加（後述） |
| 軌跡ログ・運行記録（trips / trip_playback_events） | ✅ 完了 | 前回から変更なし |
| 音声ファイル署名付き URL（API Route 経由） | ✅ 完了 | 前回から変更なし |
| 管理画面 UI（サイドバー・共通コンポーネント） | ✅ 完了 | 前回から変更なし |
| バス管理画面（DB 実接続） | ✅ 完了 | **フェーズ7 で実装** |
| 再生ログ画面（DB 実接続） | ✅ 完了 | **フェーズ7 で実装** |
| 管理画面 API Routes（buses / trips / profile / password） | ✅ 完了 | **フェーズ7 で新規作成** |
| 設定画面（プロフィール・パスワード変更） | ✅ 完了 | **フェーズ7 で実装** |
| パスワードリセット画面（Supabase Auth 実接続） | ✅ 完了 | **フェーズ7 で修正** |
| ダッシュボード統計（DB 実取得） | ✅ 完了 | **フェーズ7 で修正** |
| proxy.ts（旧 middleware.ts） リネーム | ✅ 完了 | **フェーズ7 で対応** |
| 進行方向インクリメント（sequence 管理） | ✅ 完了 | **フェーズ8 で実装** |
| 再生キューの音声取得タイムアウト（120秒） | ✅ 完了 | **フェーズ8 で実装** |
| `skipped` ステータス（型・スキーマ・ログ UI） | ✅ 完了 | **フェーズ8 で実装** |
| MQTT / 3.5mm 入力連携 | ❌ 未着手 | 実機（タブレット）待ち |
| Python ヘルパースクリプト（Termux:Boot） | ❌ 未着手 | 実機待ち |

---

## 1. フェーズ7 で実施した修正・実装

### 1-1. バス管理・再生ログのDB実接続

| ファイル | 内容 |
|---|---|
| `src/app/api/admin/buses/route.ts` | GET（buses + devices JOIN）/ POST（バス追加・トークン自動生成） |
| `src/app/api/admin/buses/[id]/route.ts` | PATCH（devices.is_active=false で無効化） |
| `src/app/api/admin/trips/route.ts` | GET（日付・バスコードフィルタ付き、playCount は events 件数） |
| `src/app/api/admin/trips/[id]/events/route.ts` | GET（radio_program_items → contents 結合でタイトル取得） |
| `src/app/(admin)/buses/page.tsx` | stubs.ts → fetch('/api/admin/buses') に置換 |
| `src/app/(admin)/logs/page.tsx` | stubs.ts → fetch('/api/admin/trips') に置換 |

### 1-2. 設定画面のDB実接続

| ファイル | 内容 |
|---|---|
| `src/app/api/admin/profile/route.ts` | GET（profiles + auth.email）/ PATCH（display_name 更新） |
| `src/app/api/admin/password/route.ts` | POST（旧PW検証 → auth.updateUser） |
| `src/app/(admin)/settings/page.tsx` | stubs.ts → fetch('/api/admin/profile') に置換 |

### 1-3. 仕様書との不整合修正

| 項目 | 修正内容 |
|---|---|
| `trip_playback_events.status` の型不一致 | `@/types` の PlayEvent.status を `played/failed/cancelled` に統一（管理画面が `completed/skipped/error` を期待していた） |
| パスワードリセット画面が stubs.ts 使用 | `supabase.auth.resetPasswordForEmail` / `onAuthStateChange(PASSWORD_RECOVERY)` に置換 |
| ダッシュボード統計がハードコード | Server Component で Promise.all カウント取得に変更 |
| broadcast ペイロードに heading/speed がない | `realtime.ts` の `sendLocation` シグネチャ拡張、`play/page.tsx` から渡すよう修正 |
| 位置ログに heading/speedKmh がない | `lastHeadingRef` / `lastSpeedKmhRef` を追加し LocationBody に含める |
| `middleware.ts` 非推奨警告 | `src/proxy.ts` にリネームし `proxy` 関数名に変更 |

### 1-4. エラーハンドリング整備

- `buses/page.tsx`, `logs/page.tsx`, `settings/page.tsx` に SWR `error` 状態と `<ErrorState retry>` を追加
- `audio/[id]/route.ts`, `program/route.ts` に top-level try-catch を追加
- 全 admin API Route は try-catch + 日本語エラーレスポンスが揃った状態

### 1-5. ビルド確認

- `pnpm typecheck`：エラーなし
- `pnpm build`：警告なし、28 ページ全てビルド成功

---

## 2. フェーズ8 で実施した実装

### A. `skipped` ステータスのアプリ側反映（✅ 完了）

DBスキーマ（migration L346）には既に定義済みだったが、アプリ側に反映されていなかった。

- `src/lib/schemas/client.ts`：`PlaybackEventBodySchema.status` に `'skipped'` 追加
- `src/types/index.ts`：`PlayEvent.status` に `'skipped'` 追加
- `src/app/(admin)/logs/page.tsx`：`getStatusLabel()` / `getStatusBadgeVariant()` に `'skipped'` 対応追加

### B. 音声取得タイムアウト 120秒（✅ 完了）

`playNextFromQueue` のキャッシュミス時 fetch に `AbortController` + タイマーを追加。

- `src/app/(client)/client/play/page.tsx`：タイムアウト時は既存の catch 節で `failed` 記録 + `PlaybackErrorDialog` 表示
- 追加定数：`NEXT_PUBLIC_AUDIO_TIMEOUT_SEC`（デフォルト 120）

### C. 進行方向インクリメント・sequence 管理（✅ 完了）

3パターンの通過判定を実装。全アイテム反復から「現在ターゲットのみ」評価に変更。

```
Pattern A（正常再生）：10m 圏内 → 再生完了 → N+1
Pattern B（通過スキップ）：hasEnteredRadius=true + minDist から 20m 以上離れた → skipped → N+1
Pattern C（タイムアウト）：NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN 経過で圏外のまま → skipped → N+1
```

変更箇所：`src/app/(client)/client/play/page.tsx`
- 新 ref：`sortedItemsRef`、`currentSequenceIdxRef`、`hasEnteredRadiusRef`、`minDistanceToTargetRef`、`lastSmoothedPositionRef`、`waypointTimerRef`、`advanceToNextSequenceRef`
- 新 callback：`advanceToNextSequence`（Pattern B/C で呼ばれる）
- `handlePositionUpdate`：全アイテム反復 → 現在ターゲット1件のみ評価
- `playNextFromQueue` の `ended` ハンドラ：`advanceToNextSequenceRef.current()` 呼び出し追加（Pattern A）
- `init()`：sequence ソート・先頭スキップ・最初のタイムアウトタイマー開始を追加
- アンマウント cleanup：`waypointTimerRef` clearTimeout 追加
- 追加定数：`NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN`（デフォルト 5）、`PASS_THROUGH_MARGIN_M = 20`

### D. CLAUDE.md 更新（✅ 完了）

- §7：`swr`（承認済み）追記
- §3-4：車内クライアントフロー詳細（3パターン・タイムアウト）更新
- 付録A：変更履歴 rev4 追加

---

## 3. 残タスク

### ⚪️ 保留（実機 or デプロイ後）

| 項目 | 保留理由 |
|---|---|
| MQTT / 3.5mm 入力連携 | 実機（Tab M11 + 車内アナウンスシステム）が揃ってから。`src/lib/mqtt.ts` 新規作成 + `mqtt` パッケージ追加が必要 |
| Python ヘルパースクリプト（Termux:Boot） | 同上 |
| キャッシュバージョニング | デプロイ後に古いキャッシュ問題が出てから対処 |

> フェーズ8 完了時点で、実機テスト前必須の実装はすべて完了。残タスクは実機待ちのみ。

---

## 3. 仕様書との既知の差異（意図的）

前回ステータスから変化なし。実装確定時の判断として記録。

| 判断内容 | 場所 | 補足 |
|---|---|---|
| マルチスピーカー TTS | `src/lib/tts.ts` | `multiSpeakerVoiceConfig` を使用 |
| SHA-256 ハッシュによる重複排除 | `supabase/functions/poll-sites/index.ts` | 仕様書は「完全一致は重複排除」のみ |
| PCM → WAV 手動変換（`pcmToWav`） | `src/lib/tts.ts` | TTS API レスポンスが raw PCM |
| `contents.metadata.active_audio_file_id` | `src/app/(admin)/contents/actions.ts` | コンテンツ:音声ファイル 1:多設計 |
| `trip_playback_events.status` に `cancelled` | DB スキーマ + `play/page.tsx` | 外部音声中断用に追加。仕様書は `played/skipped/failed` の3種 |
| GPS 精度低下時の開始禁止 | `client/confirm/page.tsx` | 仕様書は「警告表示」のみ |
| 音声プリキャッシュ開始タイミングが1ステップ遅れ | `play/page.tsx` | confirm 画面「OK 後」の仕様に対し、play 画面 init 完了後 |

---

## 4. 関連ファイルマップ（主要箇所）

```
src/
├── lib/
│   ├── geo.ts                    ✅ ハヴァーサイン + GPS 平滑化
│   ├── realtime.ts               ✅ broadcast（heading/speed 追加済み）
│   ├── tts.ts                    ✅ TTS（マルチスピーカー、PCM→WAV）
│   └── mqtt.ts                   ❌ 未作成（実機待ち）
├── app/(client)/client/
│   ├── play/page.tsx             ✅ 再生ロジック（sequence 管理・タイムアウト実装済み）
│   └── confirm/page.tsx          ✅ 番組確認（GPS active 必須）
├── app/(admin)/
│   ├── page.tsx                  ✅ ダッシュボード（DB カウント取得済み）
│   ├── buses/page.tsx            ✅ DB 実接続済み
│   ├── logs/page.tsx             ✅ DB 実接続済み
│   └── settings/page.tsx         ✅ DB 実接続済み
├── app/api/admin/
│   ├── buses/route.ts            ✅ GET / POST
│   ├── buses/[id]/route.ts       ✅ PATCH（無効化）
│   ├── trips/route.ts            ✅ GET（フィルタ付き）
│   ├── trips/[id]/events/route.ts ✅ GET
│   ├── profile/route.ts          ✅ GET / PATCH
│   ├── password/route.ts         ✅ POST
│   ├── scriptify/route.ts        ✅ 既存
│   └── tts/route.ts              ✅ 既存
├── app/(auth)/reset-password/
│   ├── page.tsx                  ✅ Supabase Auth 実接続済み
│   └── confirm/page.tsx          ✅ Supabase Auth 実接続済み
├── lib/stubs.ts                  ⚠️ モック残骸（型は更新済み、将来削除可）
└── src/proxy.ts                  ✅ 旧 middleware.ts（リネーム済み）

supabase/
├── functions/
│   ├── poll-sites/index.ts       ✅ ポーリング実行
│   └── ping-keep-alive/index.ts  ✅ auto-pause 対策
└── migrations/
    ├── 20260501000000_initial_schema.sql   ✅ 全テーブル定義済み
    └── 20260507000000_schedule_cron_jobs.sql ✅ pg_cron 定義済み

public/sw.js                      ✅ Service Worker（バージョンはハードコード・保留）
```
