# 実装進捗状況（フェーズ1〜6 監査結果）

最終更新: 2026-05-07

本ドキュメントは、仕様書（`docs/functional_spec_v2.md`）との照合による実装進捗の記録です。
フェーズ7以降の着手前に参照してください。

---

## 実装済みサマリ

| 領域 | 状態 |
|---|---|
| DB スキーマ（全テーブル・RLS・トリガー） | ✅ 完了 |
| ポーリングバッチ（Edge Function + pg_cron） | ✅ 完了 |
| ping-keep-alive（auto-pause 対策） | ✅ 完了 |
| ポーリングサイト管理 CRUD | ✅ 完了（DB 実接続） |
| コンテンツ管理 CRUD + AI台本化 | ✅ 完了（DB 実接続） |
| TTS 音声生成・音声ファイル管理 | ✅ 完了（DB 実接続） |
| ラジオ番組管理 CRUD + 地図 UI | ✅ 完了（DB 実接続） |
| 車内クライアント（認証・番組選択・確認・再生） | ✅ 完了 |
| ハヴァーサイン距離判定 + GPS 平滑化 | ✅ 完了 |
| Cache API プリキャッシュ + Service Worker | ✅ 完了 |
| Realtime broadcast（位置送信） | ✅ 完了 |
| 軌跡ログ・運行記録（trips / trip_playback_events） | ✅ 完了 |
| 音声ファイル署名付き URL（API Route 経由） | ✅ 完了 |
| 管理画面 UI（サイドバー・共通コンポーネント） | ✅ 完了 |
| MQTT / 3.5mm 入力連携 | ❌ 未着手 |
| バス管理画面（DB 実接続） | ❌ モックのまま |
| 再生ログ画面（DB 実接続） | ❌ モックのまま |
| Python ヘルパースクリプト（Termux:Boot） | ❌ 未着手 |

---

## 1. 仕様書に書いてあるが未実装の機能

### MUST 未実装

| 機能 | 仕様書参照 | 現状 |
|---|---|---|
| **MQTT / 3.5mm入力連携** | §5-8, §11 | `src/lib/mqtt.ts` 存在しない。MQTT.js 未導入。外部音声連携は UI トグルのダミーのみ |
| **Python ヘルパースクリプト** | §14-2 A | `audio_monitor.py`・Termux:Boot 起動スクリプトがリポジトリにない |
| **路線上マッピング + 進行方向インクリメント** | §4-2 | `sequence` カラムはDB定義済みだが、再生判定は全アイテムへの単純距離判定のみ。「一方向インクリメント」未実装 |
| **再生キューの120秒タイムアウト自動削除** | §5-4 | `play/page.tsx` に対応ロジックなし |
| **バス管理・再生ログのDB実接続** | §8-2 | `/admin/buses` と `/admin/logs` は `stubs.ts` のモックデータのまま |

### SHOULD 未実装

| 機能 | 仕様書参照 | 現状 |
|---|---|---|
| MQTT 接続ステータス表示 | §5-5 | GPS・サーバー通信は表示あり。外部音声（MQTT）接続状況なし |

### 仕様書記載との微差異

| 項目 | 仕様書 §5-7 | 実装 |
|---|---|---|
| broadcast ペイロード | `{ lat, lng, heading, speed, ts }` | `{ lat, lng, ts }` のみ（heading, speed 省略） |
| 音声プリキャッシュ開始タイミング | confirm 画面「OK 後」 | play 画面の init 完了後（1ステップ遅れ） |

---

## 2. 実装したが仕様書に記載がない設計判断（独自判断）

| 判断内容 | 場所 | 補足 |
|---|---|---|
| **マルチスピーカーTTS**（SPEAKER_1 + SPEAKER_2） | `src/lib/tts.ts` | 仕様書にシングル/マルチ指定なし。`multiSpeakerVoiceConfig` を使用 |
| **SHA-256 ハッシュによる重複排除** | `supabase/functions/poll-sites/index.ts` | 仕様書は「完全一致は重複排除」のみ。実装手段は独自判断 |
| **PCM → WAV 手動変換**（`pcmToWav`） | `src/lib/tts.ts` | TTS API レスポンスが raw PCM のためヘッダ付与。音声フォーマット仕様は仕様書に記載なし |
| **`contents.metadata.active_audio_file_id`** | `src/app/(admin)/contents/actions.ts` | コンテンツ:音声ファイルを1:多設計にし、active を metadata JSONB で管理。仕様書 §8 に明示なし |
| **`trip_playback_events.status` に `cancelled` 追加** | DB スキーマ + `play/page.tsx` | 仕様書記載は `played/skipped/failed` の3種。外部音声中断用に追加。DB とコードは一貫 |
| **GPS 精度低下時の開始禁止**（`canStart` の制約） | `client/confirm/page.tsx` | `low-accuracy` でも開始不可。仕様書は「警告表示」のみで禁止要件は明示なし |
| **shadcn/ui の全面採用** | `src/components/ui/` | CLAUDE.md §6「要相談」のまま実質採用済み |
| **SWR（useSWR）の使用** | `logs/page.tsx`, `buses/page.tsx` | CLAUDE.md §6「依存追加は事前承認制」だが追加済み |

---

## 3. 仕様書の記述が曖昧で独自解釈した箇所

| 箇所 | 仕様書の記述 | 実装の解釈 |
|---|---|---|
| **路線上マッピングの意味**（§4-2）| 「現在位置を路線上にマッピング、次の再生地点を一意に特定」| 路線ラインへの正射影ではなく、各アイテムへの直線距離で判定 |
| **Service Worker のキャッシュ put 主体**（§9-1）| 「Service Worker で次5本をキャッシュ」| put は `play/page.tsx` が直接実施。SW は `/audio-cache/` パスへのリクエストを返すだけ |
| **GPS 未受信時の開始可否**（§5-3）| 「ステータス表示 → OK で再生モードへ移行」| `active` かつ `connected` の両方でなければ開始ボタンが disabled |
| **キャッシュバージョニング**（§9-1）| 「`CACHE_NAME` を環境変数で管理」| Service Worker 内は環境変数にアクセスできない構造のため `'autodj-audio-v1'` をハードコード |

---

## 4. フェーズ7以降で影響が出そうな懸念点

| 懸念 | 優先度 | 詳細 |
|---|---|---|
| **進行方向管理の欠如** | 高 | U ターン・折り返し路線で既再生アイテムが再発火するバグになりうる。修正時は `play/page.tsx` の位置判定ロジック全体に触れる |
| **MQTT が丸ごと未着手** | 高 | `lib/mqtt.ts` 新規実装、MQTT.js パッケージ導入、`externalAudio` 状態管理の切り替え、HiveMQ + Termux:Boot 実機検証まで一式が残タスク |
| **バス管理・再生ログがモックのまま** | 高 | 本接続には API Route 設計も含めて実装が必要。`stubs.ts` のモック関数が散在しているため切り替え時の影響範囲が広い |
| **120秒タイムアウト未実装** | 中 | 通信遅延などでキューが詰まったとき無限待機になる。実機テストで先に問題が出やすい箇所 |
| **shadcn/ui の未正式化** | 低 | フェーズ7以降でコンポーネント追加・変更の際に判断基準が曖昧。CLAUDE.md を更新して採用を明示するか判断が必要 |
| **broadcast ペイロードに heading/speed がない** | 低 | 管理画面でリアルタイム位置トラッキングを実装する際、進行方向表示ができない。ペイロードスキーマ変更は既存購読者にも影響 |
| **pg_cron の Edge Function 呼び出し方式** | 中 | `supabase_functions.http_request('poll-sites', ...)` がリモート環境で正しく解決されるか要確認（ローカルテスト未実施） |

---

## 関連ファイルマップ（主要箇所）

```
src/
├── lib/
│   ├── geo.ts                    ✅ ハヴァーサイン + GPS平滑化
│   ├── realtime.ts               ✅ broadcast チャンネル（heading/speed 省略あり）
│   ├── tts.ts                    ✅ TTS（マルチスピーカー、PCM→WAV）
│   └── mqtt.ts                   ❌ 未作成
├── app/(client)/client/
│   ├── play/page.tsx             ✅ 再生ロジック（120秒タイムアウト・sequence管理なし）
│   └── confirm/page.tsx          ✅ 番組確認（GPS active 必須）
├── app/(admin)/
│   ├── buses/page.tsx            ❌ モック（stubs.ts）
│   └── logs/page.tsx             ❌ モック（stubs.ts）
├── lib/stubs.ts                  ❌ モック関数の残骸（要置換）
└── prompts/                      ✅ scriptify.ts, tts-config.ts

supabase/
├── functions/
│   ├── poll-sites/index.ts       ✅ ポーリング実行
│   └── ping-keep-alive/index.ts  ✅ auto-pause 対策
└── migrations/
    ├── 20260501000000_initial_schema.sql   ✅ 全テーブル定義済み
    └── 20260507000000_schedule_cron_jobs.sql ✅ pg_cron 定義済み

public/sw.js                      ✅ Service Worker（バージョンはハードコード）
```
