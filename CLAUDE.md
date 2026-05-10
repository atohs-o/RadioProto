# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

このファイルは Claude Code が本リポジトリで作業する際の運用ガイドです。実装着手前に必ず読んでください。本ファイルの指示は機能仕様書(`docs/functional_spec_v2.md`)と矛盾しないよう書かれています。両者で食い違いがある場合は仕様書を優先し、本ファイルの更新を提案してください。

---

## 0. プロジェクト概要

**モビリティ車内音声コンテンツシステム**のプロトタイプ。

- バス車内タブレットで現在地に応じた観光・行政・イベント情報を音声再生
- 管理画面でコンテンツ CRUD、Web ポーリング・テキスト手入力から台本を自動生成、Vertex AI で音声合成
- MVP は1路線・1番組・10〜20音声

詳細は `docs/functional_spec_v2.md` を参照。本ファイルは**実装規約**を担当します。

---

## 1. 技術スタック（決定事項）

| レイヤー | 採用 |
|---|---|
| フロントエンド | Next.js 16 (App Router) + TypeScript strict |
| パッケージマネージャ | **pnpm**（npm/yarn 禁止） |
| DB / Storage / Auth / Realtime | Supabase（東京リージョン ap-northeast-1） |
| UI コンポーネント | **shadcn/ui**（`src/components/ui/` に配置済み） |
| 定期実行 | Supabase Scheduled Edge Functions（Deno） |
| AI 要約・台本化 | Gemini Flash（Vertex AI 経由） |
| 音声合成 | Vertex AI `gemini-2.5-flash-tts`（`GEMINI_TTS_MODEL` env で固定） |
| 地図 | Leaflet + OSM タイル（SSR 無効化必須） |
| 空間判定 | `@turf/boolean-point-in-polygon`（クライアント完結） |
| MQTT | MQTT.js + HiveMQ Cloud |
| オフライン | Cache API（手書き）、workbox 不使用 |
| バリデーション | zod |
| スタイル | Tailwind CSS v4 |

---

## 2. コマンド

```bash
pnpm dev                          # 開発サーバー
pnpm typecheck                    # tsc --noEmit
pnpm lint                         # ESLint
pnpm format                       # Prettier
pnpm gen:types                    # supabase gen types typescript --linked > src/types/database.types.ts

supabase start                    # ローカル Supabase 起動
supabase functions serve --env-file .env.local  # Edge Functions ローカル
supabase migration new <name>     # 新規 migration 作成
supabase db push                  # リモートに適用
```

DB スキーマ変更後は必ず `pnpm gen:types` を実行。型がズレた状態でコミットしない。

---

## 3. アーキテクチャ

### 3-1. Supabase クライアントの使い分け（重要）

3 つのクライアントが用途別に存在する。混用しないこと。

| ファイル | キー | 用途 |
|---|---|---|
| `src/lib/supabase/server.ts` | anon key + cookie | Server Components / API Route（管理画面） |
| `src/lib/supabase/admin.ts` | **service role**（RLS バイパス） | Server Actions / API Routes で特権操作が必要な場合 |
| `src/lib/supabase/client.ts` | anon key | `'use client'` コンポーネント（管理画面） |

`createAdminClient()` は `'use client'` ファイルで import **禁止**。`SUPABASE_SERVICE_ROLE_KEY` が露出する。

### 3-2. 環境変数（`src/lib/env.ts`）

zod で起動時に検証される。

```typescript
publicEnv            // NEXT_PUBLIC_* 変数（モジュールロード時に parse）
getServerEnv()       // サーバー専用シークレット（Server Component / API Route からのみ呼ぶ）
```

`getServerEnv()` を `'use client'` コンポーネントや `NEXT_PUBLIC_` 経由で使わない。

### 3-3. 認証の2系統

```
管理画面: Supabase Auth（cookie セッション）
  middleware.ts で /login へリダイレクト制御

車内クライアント: デバイストークン（localStorage）
  X-Device-Token ヘッダーで /api/client/* に送信
  src/app/api/client/_lib/device-auth.ts で検証 → bus_id 特定
```

車内クライアントは Supabase Auth を使わない。`anon key` も原則埋め込まない（Realtime broadcast 購読のみ例外）。

### 3-4. 車内クライアントのフロー

```
/client           → 番組選択
/client/setup     → デバイストークン登録（localStorage 保存）
/client/confirm   → 確認
/client/play      → GPS トリガー型音声再生（メイン画面）
```

`/client/play`（`src/app/(client)/client/play/page.tsx`）の主要処理:
- `NEXT_PUBLIC_TRIGGER_RADIUS_M`（デフォルト 10m）以内に入ったアイテムをキューに追加
- GPS は直近3点の移動平均でスムージング（`src/lib/geo.ts` の `smoothGps`）
- 音声は Cache API に先読み（名前: `autodj-audio-v1`、キー: `/audio-cache/${audioFileId}`）
- objectURL は再生終了・エラー・運行終了時に必ず `URL.revokeObjectURL()` で解放

### 3-5. 音声ファイルの取得経路

```
車内クライアント
  → GET /api/client/audio/[id]（X-Device-Token 付き）
  → API Route が Service Role で署名付き URL 生成（1時間有効）
  → 署名付き URL を返す → クライアントが Storage から直接取得
```

`audio-files` バケットは非公開。直接アクセス不可。

### 3-6. 番組アイテムと音声ファイルの関係

コンテンツは音声を複数持てる（再生成のたびに `audio_files` レコードが追加される）。

- `contents.metadata.active_audio_file_id` — 現在使用する音声ファイル ID
- `radio_program_items.audio_file_id` — 番組アイテムに紐づいた音声ファイル ID

**`saveProgramAction`（`src/app/(admin)/programs/actions.ts`）のパターン**:
- アイテムを全削除 → 全再挿入（upsert ではない）
- 挿入時に `contents.metadata.active_audio_file_id` を DB から引いて `audio_file_id` をセット

**`getContents()`（`src/lib/api/contents.ts`）のパターン**:
- `audio_files` を結合取得するとき `metadata.active_audio_file_id` で対応ファイルを選ぶ（order 未指定のため `[0]` は不定）

### 3-7. Server Actions の `revalidatePath`

コンテンツの音声を変更したとき、`/programs` キャッシュも無効化が必要。

| Action | revalidatePath |
|---|---|
| `updateContentAction` | `/contents`, `/contents/${id}` |
| `setActiveAudioAction` | `/contents/${id}` |
| `saveProgramAction` | `/programs`, `/programs/${id}` |

音声生成（`/api/admin/tts`）は API Route のため `revalidatePath` を呼べない。管理画面でページ再読み込みが必要な場合がある。

---

## 4. ディレクトリ構成（主要部分）

```
src/
├── app/
│   ├── (admin)/          # 管理画面（Supabase Auth 必須）
│   │   ├── contents/     # コンテンツ CRUD + 音声生成
│   │   ├── programs/     # 番組・ルート・紐付けセット
│   │   ├── polling-sites/# ポーリングサイト管理
│   │   └── buses/        # バス・デバイス管理
│   ├── (client)/client/  # 車内クライアント（デバイストークン認証）
│   └── api/
│       ├── admin/        # 管理用 API（tts, scriptify）
│       └── client/       # 車内クライアント用 API（auth, program, audio, trip, location, playback-event）
├── components/
│   ├── ui/               # shadcn/ui コンポーネント（直接編集しない）
│   ├── admin/            # 管理画面専用
│   ├── client/           # 車内クライアント専用
│   ├── common/           # 共通
│   └── map.tsx           # Leaflet MapView（map/map.tsx が dynamic import ラッパー）
├── lib/
│   ├── api/              # サーバー側データ取得（getContents, getProgram 等）
│   ├── supabase/         # server.ts / admin.ts / client.ts
│   ├── schemas/          # zod スキーマ（content.ts / client.ts / polling-sites.ts）
│   ├── env.ts            # 環境変数検証
│   ├── geo.ts            # haversineDistance / smoothGps
│   ├── tts.ts            # Vertex AI TTS 呼び出し
│   ├── realtime.ts       # Supabase Realtime broadcast ラッパー
│   └── vertex-ai.ts      # アクセストークン取得・URL 構築
├── prompts/
│   ├── scriptify.ts      # 台本生成プロンプト
│   └── tts-config.ts     # TTS スタイル設定（voice, stylePrompt 等）
└── types/
    └── database.types.ts # 自動生成（手動編集禁止）

supabase/
├── migrations/           # 既存ファイル編集禁止、新規作成のみ
└── functions/
    ├── poll-sites/       # 1日3回ポーリング
    ├── ping-keep-alive/  # 3日に1回 SELECT 1（auto-pause 対策）
    └── _shared/          # 共通ユーティリティ（gemini.ts, strip-html.ts）
```

---

## 5. コーディング規約

### TypeScript

- **strict mode 必須**、**`any` 禁止**（型不明なら `unknown` + zod）
- `database.types.ts` は手動編集禁止
- API 入出力は `src/lib/schemas/` の zod スキーマで定義

### 命名

- 関数・変数: camelCase（英語）
- コンポーネント: PascalCase
- ファイル: コンポーネントは PascalCase、それ以外は kebab-case
- DB カラム: snake_case（TS 側もそのまま使う）
- コメント・UI 文言: 日本語

### DB JSONB カラムの命名規約（仕様書 §8-1）

| カラム名 | 用途 | 編集主体 |
|---|---|---|
| `metadata` | 記録・観測値（履歴として残す） | システム自動 |
| `settings` | 設定値（ユーザーが意図的に変更） | ユーザー / 管理者 |

---

## 6. 各領域の固有ガードレール

### Leaflet（MUST）

- `dynamic(() => import(...), { ssr: false })` でラップ必須（`window` 参照でクラッシュ）
- `useEffect` クリーンアップで `map.remove()` 必須（Strict Mode 二重マウント対策）
- 地図コンテナに Tailwind `isolate` class を付けて Leaflet の z-index を閉じ込める

### TTS（MUST）

- `systemInstruction` は `gemini-2.5-flash-tts` では**サポートされない**（400エラーになる）
- スタイル指示は `contents` のテキスト先頭に自然言語の指示文として付加する
- `stylePrompt` は `SPEAKER_1:説明文` 形式にしない（台詞ラベルと混同して読み上げられる）
- 台本テキストは 4000 バイト以内（`stylePrompt` 分も合算される）
- 認証は `google-auth-library` + サービスアカウント鍵。Application Default Credentials は Vercel 環境では動かない場合がある

### Supabase Edge Functions（Deno）

- `process.env.X` → `Deno.env.get('X')`
- `require('lib')` → `import x from 'npm:lib'`
- 共通処理は `supabase/functions/_shared/` に配置

### Service Worker / Cache API

- `workbox-*` 導入禁止（手書き）
- キャッシュ名: `autodj-audio-v1`、キー: `/audio-cache/${audioFileId}`
- `register()` は `useEffect` 内で1回のみ

### Supabase Realtime

- ライブ位置共有（DB 書き込みなし）→ **broadcast**
- 管理画面の DB 変更リアルタイム反映 → **postgres_changes**
- `src/lib/realtime.ts` に集約し、コンポーネントから直接 `supabase.channel` を呼ばない

---

## 7. 依存追加ルール

- **追加は事前承認制**: `pnpm add` を勝手に実行せず、理由とともに提案する
- `lock` ファイルは `pnpm-lock.yaml` のみ

**追加禁止**: `workbox-*`、`redux/zustand/jotai`、`axios/ky`、`moment/dayjs`、`lodash`

---

## 8. 触ってはいけない場所

| パス | 禁止理由 |
|---|---|
| `supabase/migrations/*.sql`（既存） | 適用済み。新規作成のみ可 |
| `src/types/database.types.ts` | 自動生成。次の `gen:types` で上書きされる |
| `.env*` | 秘密情報。Claude Code から書き換え禁止 |
| `pnpm-lock.yaml` | 自動更新。手動編集禁止 |

### 運用前提（変更しない）

- **Supabase Email サインアップは無効**。root ユーザーは Service Role 経由で作成済み
- **Service Role キーはクライアント側コードで使わない**（`NEXT_PUBLIC_` 禁止）
- **車内クライアントは Supabase クライアントを直接使わない**（API Route 経由）

---

## 9. Plan Mode 運用ルール

新規機能・大きな変更の前は**必ず Plan を出す**。

Plan に含める内容:
1. 目的と仕様書のセクション
2. 変更ファイル一覧（新規 / 編集）
3. DB スキーマ変更の有無
4. 新規依存追加の有無
5. テスト方針

Plan 不要:
- 1ファイル・10行未満のバグ修正
- 挙動変更なしのリファクタリング・ドキュメント更新

---

## 10. コミット規約

- Conventional Commits: `feat:` / `fix:` / `refactor:` / `docs:` / `chore:`
- 1機能=1コミット原則
- メッセージ本文は日本語可

---

## 付録 A: 変更履歴

| 日付 | 変更内容 |
|---|---|
| 2026-05-01 | 初版作成（機能仕様書 v2 rev3 準拠） |
| 2026-05-01 (rev2) | DB 初期マイグレーション後の追記 |
| 2026-05-10 (rev3) | 実装フェーズ完了後の改訂：Supabase クライアント三種・env.ts パターン・音声ファイル選択ロジック・車内クライアントフロー・TTS systemInstruction 非サポートを追記、shadcn/ui 採用済みに更新 |
