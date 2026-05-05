# CLAUDE.md

このファイルは Claude Code が本リポジトリで作業する際の運用ガイドです。実装着手前に必ず読んでください。本ファイルの指示は機能仕様書(`docs/functional_spec_v2.md`)の指示と矛盾しないよう書かれています。両者で食い違いがある場合は仕様書を優先し、その上で本ファイルを更新する提案をしてください。

---

## 0. プロジェクト概要

**モビリティ車内音声コンテンツシステム** のプロトタイプ。

- バス車内のタブレットで、現在地に応じた観光・行政・イベント情報を音声再生する
- 管理画面でコンテンツを CRUD、Web ポーリング・テキスト手入力から台本を自動生成、Vertex AI で音声合成
- MVP は1路線・1番組・10〜20音声。実証フェーズの商材として「自動収集 → 台本化 → 音声合成パイプライン」を訴求する
- 実装期間目安:実働2-3週間

詳細は `docs/functional_spec_v2.md` を参照してください。本ファイルは**実装規約**、仕様書は**機能要件**を担当します。

---

## 1. 必読ドキュメント

実装着手前に必ず一読:

1. `docs/functional_spec_v2.md` — 機能仕様書(本実装の唯一の真実)
   - **§0-3「意図的にオープンにする領域」**:仕様書に書かれていても「placeholder」として扱う領域(UI 細部・LLM プロンプト・地図 UI 操作性)
   - **§10「アーキテクチャ意思決定の根拠」**:なぜこの構成かの背景
   - **§11「MVP スコープ(MoSCoW)」**:何を作って何を作らないか
2. 本ファイル(`CLAUDE.md`) — 実装規約・ガードレール

仕様書 §0-2 の表記規約に従って:
- **決定事項** → 変更不可、勝手に変えない
- **推奨案** → 強い推奨、変える場合は事前提案
- **オープン** → 最素朴な実装で進めて、出力を見せて翔太さんと対話で詰める
- **Phase 2** → MVP では実装しない

---

## 2. 技術スタック(決定事項)

| レイヤー | 採用 |
|---|---|
| フロントエンド | Next.js 15+ (App Router) + TypeScript strict |
| パッケージマネージャ | **pnpm**(npm/yarn 禁止) |
| ホスティング | Vercel(MVP は Hobby) |
| DB / Storage / Auth / Realtime / Edge Functions | Supabase(東京リージョン ap-northeast-1) |
| 定期実行 | Supabase Scheduled Edge Functions(Deno) |
| AI 要約・台本化 | Gemini Flash(Vertex AI 経由) |
| 音声合成 | Vertex AI `gemini-2.5-flash-tts`(モデル名は env で固定) |
| 地図 | Leaflet + React Leaflet + OSM タイル |
| 空間判定 | `@turf/boolean-point-in-polygon`(クライアント完結) |
| MQTT(車載) | MQTT.js + HiveMQ Cloud(無料 tier) |
| オフライン | Cache API + Service Worker(workbox 不使用) |
| バリデーション | zod |
| スタイル | Tailwind CSS(MVP は素の Tailwind) |

---

## 3. プロジェクトコマンド

```bash
# 開発
pnpm dev                          # Next.js 開発サーバー
supabase start                    # ローカル Supabase 起動
supabase functions serve --env-file .env.local  # Edge Functions ローカル

# 型生成(DB スキーマ変更後に必ず実行)
pnpm gen:types                    # = supabase gen types typescript --linked > src/types/database.types.ts

# マイグレーション
supabase migration new <name>     # 新規 migration 作成
supabase db push                  # リモートに適用
supabase db reset                 # ローカル DB リセット(migration 再適用)

# 検証
pnpm typecheck                    # tsc --noEmit
pnpm lint                         # ESLint
pnpm format                       # Prettier
```

**注意**: パッケージマネージャーは **pnpm 固定**。`npm` / `yarn` コマンドは使わない(§6 参照)。

DB スキーマを変更したら**必ず `pnpm gen:types` を実行**して型を更新してください。型がズレた状態でコミットしないでください。

上記コマンドを動かすために、`package.json` の `scripts` に以下を定義しておくこと:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "gen:types": "supabase gen types typescript --linked > src/types/database.types.ts"
  }
}
```

`gen:types` は `supabase` CLI がグローバルにインストールされていること、かつ `supabase link` でプロジェクトと紐づいていることが前提。初回は `supabase link --project-ref <your-ref>` を先に実行すること。

---

## 4. ディレクトリ構成

```
src/
├── app/                  # Next.js App Router
│   ├── (admin)/          # 管理画面(認証必須)
│   ├── client/           # 車内クライアント
│   └── api/              # API Routes(TTS 生成等)
├── components/           # UI コンポーネント
├── lib/                  # ユーティリティ
│   ├── supabase.ts       # Supabase クライアント
│   ├── geo.ts            # ハヴァーサイン・GPS 平滑化
│   ├── realtime.ts       # Supabase Realtime ラッパー
│   ├── mqtt.ts           # MQTT クライアント
│   └── tts.ts            # Vertex AI TTS 呼び出し
├── schemas/              # zod スキーマ(API I/O・フォーム)
├── prompts/              # LLM プロンプトテンプレート(ハードコード禁止)
├── types/
│   ├── database.types.ts # 自動生成、手動編集禁止
│   └── *.ts              # 手動定義の型
└── hooks/                # React カスタムフック

supabase/
├── migrations/           # SQL migration(既存ファイル編集禁止)
├── functions/            # Edge Functions
│   ├── poll-sites/       # 1日3回ポーリング
│   ├── ping-keep-alive/  # 3日に1回 SELECT 1(auto-pause 対策)
│   └── _shared/          # 共通ユーティリティ
└── config.toml

docs/
└── functional_spec_v2.md
```

---

## 5. アーキテクチャ原則(決定事項)

仕様書 §10 に詳細あり。要点のみ:

1. **プロトと本番で同じアーキテクチャ**:Realtime と Edge Functions は最初から
2. **クライアント側で完結できる処理は DB に持ち込まない**:位置判定・空間判定はクライアント
3. **永続フラグの代わりにイベント記録**:再生済み管理は `trips` + `trip_playback_events`
4. **将来の拡張カラムは最初から作る、テーブルは後から足す**
5. **モデル名・閾値は環境変数化**:差し替え時に1箇所書き換えで済むように
6. **stable / GA を優先**:preview モデルは実証用途では時期尚早

---

## 6. パッケージマネージャ・依存追加

### MUST

- **pnpm 固定**:`packageManager` フィールドを `package.json` に明記する
- **依存追加は事前承認制**:`pnpm add` を勝手に実行せず、追加が必要な場合は理由とともに翔太さんに提案する
- **lock ファイルは pnpm-lock.yaml のみ**:package-lock.json / yarn.lock があれば削除

### 追加禁止リスト

| ライブラリ | 理由 |
|---|---|
| `workbox-*` | Service Worker は手書き(§9 参照) |
| `redux`, `zustand`, `jotai` | MVP は React 標準で十分(useState / useReducer / Context) |
| `axios`, `ky` | `fetch` で十分 |
| `moment`, `dayjs` | `Intl.DateTimeFormat` または `date-fns`(必要時のみ) |
| `lodash` | ES2020+ で代替可能 |
| UI コンポーネントライブラリ全般 | MVP は素の Tailwind、shadcn/ui 採用は要相談 |

### 推奨ライブラリ(必要に応じて)

- `zod`(必須):バリデーション
- `react-leaflet`, `leaflet`(必須):地図
- `@turf/boolean-point-in-polygon`(必須):ポリゴン点内判定
- `mqtt`(必須):MQTT クライアント
- `@google-cloud/aiplatform` または `google-auth-library` + 直接 REST(必須):Vertex AI 呼び出し

---

## 7. コーディング規約

### TypeScript

- **strict mode 必須**(`tsconfig.json` の `strict: true`)
- **`any` 禁止**:型不明な場合は `unknown` で受けて zod 検証
- **`as` キャスト最小化**:必要な場合は zod の `parse` を通す
- **null/undefined の区別**:DB から来る値は基本 nullable、UI 状態は undefined
- **export 順序**:型 → 定数 → 関数 → コンポーネント

### 命名

- **関数・変数名**:英語、camelCase
- **コンポーネント**:PascalCase
- **ファイル名**:コンポーネントは PascalCase(`AudioPlayer.tsx`)、それ以外は kebab-case(`use-audio-player.ts`)
- **DB カラム**:snake_case(Postgres 慣習)、TS 側にマップする際もそのまま使う
- **コメント・UI 文言・エラーメッセージ**:日本語

### 関数の書き方

- 早期 return を好む(else を減らす)
- 関数1つの責務は1つ
- Hooks は `use` プレフィックス必須
- React コンポーネントの props は型を明示(`Props` interface を上に書く)

### エラーハンドリング

- API Route / Edge Function は必ず try-catch で囲み、エラーレスポンスは zod スキーマで型付け
- ユーザーに見せるエラーメッセージは日本語、技術詳細はログのみ
- `console.error` は本番では Sentry 等に流す(MVP は Vercel logs で代替)

### DB JSONB カラムの使い分け(`metadata` vs `settings`)

仕様書 §8-1 の規約に従う:

| カラム名 | 用途 | 編集主体 |
|---|---|---|
| `metadata` | 記録・観測値(その時点の状態を残す) | システム自動 |
| `settings` | 設定値(ユーザーが意図的に変更する) | ユーザー / 管理者 |

**判断基準**:「この値を後から書き換えると過去のデータの意味が変わるか?」
- YES → `settings`(書き換え前提)
- NO → `metadata`(履歴・観測値、不変が望ましい)

新規カラム追加時はこの規約に従って命名を選ぶ。両方が必要なテーブルでは2カラム持つ。

---

## 8. 型と検証(MUST)

### Source of Truth の階層

```
DB スキーマ(supabase/migrations/)
  ↓ supabase gen types typescript
src/types/database.types.ts(自動生成、手動編集禁止)
  ↓
src/schemas/*.ts(zod スキーマ、手動定義)
  ↓ z.infer<>
コンポーネント・API Route で使う型
```

### ルール

- **`database.types.ts` は手動編集禁止**(ファイル冒頭にコメントで明記)
- **API 入出力は必ず zod スキーマで定義**:`src/schemas/` に集約
- **DB から取得したデータも zod で再検証**:RLS が外れた時の保険
- **フォーム入力も zod スキーマを使い、エラーメッセージは日本語**
- **zod スキーマと DB types に差異が出る場合**(JSONB カラム等):JSONB の中身は zod、外側は DB types

例:
```typescript
// src/schemas/content.ts
import { z } from 'zod'

export const ContentSourceTypeSchema = z.enum(['polling', 'manual', 'url', 'file'])

export const CreateContentSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください').max(200),
  script: z.string().min(1, '台本を入力してください'),
  source_type: ContentSourceTypeSchema,
  category_tag: z.string().optional(),
})

export type CreateContent = z.infer<typeof CreateContentSchema>
```

---

## 9. 各技術領域の固有ガードレール

### 9-1. Service Worker / Cache API(手書き必須)

**禁止**:`workbox-*` 系の自動生成ツールの導入

**MVP のキャッシュ戦略**(仕様書 §5-6):
- キャッシュ対象:**音声ファイルのみ**(現在地から近い順に次5本)
- 再生済み音声は順次削除
- バージョニング:`CACHE_NAME` を環境変数で管理、デプロイごとに変える

**実装時の注意**:
- Claude Code は古い workbox パターンを書きがち。**最初の Service Worker 骨格は Plan Mode で計画 → 翔太さんがレビューしてから実装**
- `register()` のタイミング:Next.js では `useEffect` 内で1回のみ
- skipWaiting / clientsClaim は最初は使わない(更新タイミングを制御しやすくするため)

### 9-2. Leaflet + React Strict Mode(MUST)

**SSR 対策(必須)**:
```typescript
// Leaflet コンポーネントは必ず dynamic import でラップ(SSR 時に window 参照で落ちる)
const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false })
```
Next.js の SSR 環境では Leaflet が `window` を参照して即クラッシュする。`dynamic` でラップしないと開発時は動いても本番ビルドで落ちる。

React 18+ Strict Mode は開発時に `useEffect` を二重実行します。Leaflet は地図インスタンスを DOM に持つため、二重マウントで「Map container is already initialized」エラーが定番。

**対策**:
```typescript
useEffect(() => {
  const map = L.map(containerRef.current!)
  // ...初期化

  return () => {
    map.remove()  // ★ クリーンアップ必須
  }
}, [])
```

**ルール**:
- 地図インスタンスは `useRef` で保持
- `useEffect` のクリーンアップで `map.remove()` を呼ぶ
- ポップアップ・マーカーの状態は React 側を source of truth にし、Leaflet 側に持たせない
- React Leaflet を使う場合、`MapContainer` の `key` を意図的に設定して再マウントを制御

### 9-3. Supabase Realtime(MUST)

**broadcast と postgres_changes を混同しない**:

| 用途 | API |
|---|---|
| ライブ位置共有(DB 書き込みなしの pub/sub) | **broadcast** |
| 管理画面で DB 変更をリアルタイム反映 | **postgres_changes** |

**ライブ位置の実装サンプル**(仕様書 §5-7 から抜粋):

```typescript
// 車載クライアント:1Hz で broadcast
const channel = supabase.channel(`bus:${busId}`, {
  config: { broadcast: { self: false, ack: false } }
})
await channel.subscribe()

navigator.geolocation.watchPosition((pos) => {
  channel.send({
    type: 'broadcast',
    event: 'location',
    payload: { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() }
  })
})

// 軌跡ログ:30秒間引きで DB INSERT
setInterval(() => {
  supabase.from('vehicle_location_logs').insert({ trip_id, bus_id, lat, lng, recorded_at: new Date() })
}, 30_000)
```

**ルール**:
- 実装は `src/lib/realtime.ts` に集約、コンポーネントから直接 `supabase.channel` を呼ばない
- `useEffect` で subscribe / unsubscribe を必ずペアで管理(購読リーク厳禁)
- 1台のクライアントで同じチャンネルを複数 subscribe しない

**車内クライアントの DB アクセス経路**(MUST、仕様書 §7-1-b):

車内クライアントは `auth.users` を介さない別系統認証(デバイストークン)のため、**Supabase クライアントを直接使わず、Next.js API Route 経由でアクセスする**。

```
車内クライアント
  ↓ デバイストークン付きで HTTP リクエスト
Next.js API Route(/api/client/*)
  ↓ devices.token と照合 → bus_id 特定
  ↓ Service Role キーで Supabase クエリ(RLS バイパス)
Supabase
```

**音声ファイルの取得経路**(MUST):
`audio-files` バケットは非公開(`public: false`)。車内クライアントは直接バケットにアクセスできない。
```
車内クライアント → GET /api/client/audio/[id]
  → API Route が Service Role で署名付き URL を生成(有効期限付き)
  → 署名付き URL を返す → 車内クライアントが直接 Storage から取得
```
音声ファイル取得用の API Route を実装する際は必ずこの経路を踏む。

- 車内クライアントには **anon key も埋め込まない**(API Route のみ経由)
- ただし Realtime broadcast の subscribe は例外:MVP では anon key を埋め込んで簡易実装(broadcast はサーバーで RLS チェックされない pub/sub のため、機密性が低い)
- Phase 2 で broadcast 用の短期トークンを API Route から発行する設計に厳格化

### 9-4. Vertex AI TTS(MUST)

**モデル名の固定**:
```typescript
const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-tts'
```

**制約と対策**(仕様書 §3-4):
- `gemini-2.5-flash-tts`:text 4000 byte / prompt 4000 byte / 合計8000 byte、出力音声は最大約655秒
- **MVP では長文分割合成は実装しない**
- ただし `synthesize` 関数のインターフェースは「内部的にチャンク配列を扱える構造」で書く:

```typescript
// src/lib/tts.ts
export async function synthesize(scriptText: string): Promise<AudioFile> {
  const chunks = splitIntoChunks(scriptText)  // MVP は [scriptText] を返すだけ
  const audioBuffers = await Promise.all(chunks.map(synthesizeChunk))
  return concatenateAudio(audioBuffers)        // MVP は audioBuffers[0] を返すだけ
}
```

**実装時の注意**:
- GA から日が浅く、Claude Code の training data カバレッジが薄い
- 公式ドキュメント URL を WebFetch で参照すること:`https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini-tts`
- 認証は Vercel 環境変数のサービスアカウント鍵 + `google-auth-library`、Application Default Credentials は Vercel 環境で動かないことがある

**台本保存時のバリデーション**:
- 台本テキスト(`text` フィールド)は **4000 byte 以内**。プロンプト込み合計で8000 byte が API 上限。
- 台本保存時にバイト数を計測し、4000 byte 超過時は警告表示

### 9-5. Supabase Edge Functions(Deno、MUST)

**ランタイムは Deno**:Node.js 固有 API は使えない。

| Node.js | Deno での代替 |
|---|---|
| `process.env.X` | `Deno.env.get('X')` |
| `fs.readFileSync` | `Deno.readTextFileSync` |
| `require('lib')` | `import x from 'npm:lib'` |

**ルール**:
- 関数1個で全件処理せず、サイトごと並列起動でタイムアウト回避(目安 400秒上限)
- シークレットは `Deno.env.get()`、ハードコード厳禁
- 共通ユーティリティは `supabase/functions/_shared/` に置き、各関数から import

**ローカル実行**:
```bash
supabase functions serve poll-sites --env-file .env.local
```

### 9-6. MQTT(車載クライアント / 3.5mm ヘルパー)

**topic 命名**:`bus/{busId}/{event}`(例:`bus/BUS_001/external_audio`)

**車載クライアント側**:
```typescript
import mqtt from 'mqtt'

const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL!, {
  username: process.env.NEXT_PUBLIC_MQTT_USER,
  password: process.env.NEXT_PUBLIC_MQTT_PASS,
})
client.subscribe(`bus/${busId}/external_audio`)
client.on('message', (topic, payload) => {
  const data = JSON.parse(payload.toString())
  // status: 'on' | 'off' に応じて再生制御
})
```

**ルール**:
- 実装は `src/lib/mqtt.ts` に集約
- 接続切断時は exponential backoff で再接続
- ペイロードは zod スキーマで検証(`MqttExternalAudioSchema`)

### 9-7. 距離計算と GPS 平滑化(MUST)

仕様書 §4-3 に従い、**ハヴァーサイン一本化、ユークリッド削除**。

```typescript
// src/lib/geo.ts
export function haversineDistance(a: LatLng, b: LatLng): number { /* ... */ }
export function smoothPosition(history: LatLng[]): LatLng {
  // 直近3点の移動平均
}
```

GPS 平滑化を入れずに距離判定すると、GPS 飛びで予定地点を「通過判定済み」になるバグが必ず出る(仕様書 §4-3 の根拠参照)。

---

## 10. 触ってはいけない場所

| パス | 禁止理由 |
|---|---|
| `supabase/migrations/*.sql`(既存) | 適用済みファイルを編集すると整合性が壊れる。**新規作成のみ可** |
| `src/types/database.types.ts` | 自動生成。手動編集すると次の `gen:types` で消える |
| `.env*` | 秘密情報。**Claude Code から書き換え禁止**、追加が必要な場合は翔太さんに依頼 |
| `pnpm-lock.yaml` | 自動更新。手動編集禁止(整合性破壊) |
| `.claude/settings.json` の deny ルール | `Read(./.env*)` だけでは Bash 経由の `cat .env*` を防げない。`Bash(cat .env*)` の deny と必ずセットで維持する |

### 運用前提(MUST、変更しない)

これらは Pre-v0 セットアップで設定済みの前提。実装中に変更する提案をしないこと。

- **Supabase Email サインアップは無効**(ダッシュボードで OFF)
  - 唯一の root ユーザーは `scripts/setup-root-user.ts` で Service Role 経由で作成済み
  - サインアップ画面 / 機能を実装しない、Phase 2 で招待制を設計する
- **Service Role キーは API Route / Edge Function のみで使用**
  - クライアント側コード(`'use client'` のファイル)に Service Role キーを import しない
  - Vercel env では `SUPABASE_SERVICE_ROLE_KEY` 名で管理、`NEXT_PUBLIC_` プレフィックスを付けない
- **車内クライアントは Supabase クライアントを直接使わず API Route 経由**(§9-3 参照)

---

## 11. Plan Mode 運用ルール(MUST)

新規機能・大きな変更に着手する前は**必ず Plan を出してください**。

### Plan に含める内容

1. **目的**:何を実現するか、仕様書のどのセクションに該当するか
2. **変更ファイル一覧**:新規作成 / 編集の区別
3. **DB スキーマ変更の有無**:あれば migration ファイル名と SQL の概要
4. **新規依存追加の有無**:あれば理由(§6 の追加禁止リストに該当しないか確認)
5. **オープン領域の判断**:仕様書 §0-3 のオープン領域に該当する判断があれば、その方針
6. **テスト方針**:手動確認の手順、自動テストを書く場合は対象
7. **想定リスク**:実装中に詰まりそうな点、判断が必要そうな点

### Plan が不要な場合

- 軽微なバグ修正(1ファイル・10行未満)
- フォーマット・リファクタリング(挙動変更なし)
- ドキュメント更新

---

## 12. コミット規約

- **1機能=1コミット原則**:Claude Code は一気に大量変更しがちなので意識的に区切る
- **Conventional Commits 推奨**:
  - `feat:` 機能追加
  - `fix:` バグ修正
  - `refactor:` 挙動変更なしのリファクタリング
  - `docs:` ドキュメントのみ
  - `chore:` ビルド・設定変更
- メッセージ本文は日本語可
- 例:`feat: 台本編集画面に音声生成ボタンを追加`

---

## 13. オープン領域(意図的に未確定)

仕様書 §0-3 で詳述されている領域。Claude Code は**「未定義=自由に決めていい」ではなく「最も素朴な実装で進めて、出力を見せて翔太さんと対話で詰める」**と解釈してください。

### A. UI / UX の細部

- レイアウト、操作フロー、状態遷移、表示密度、タブ構成、エラー表示の温度感、ピンの色分け等
- v0 で複数バリエーション素描 → Claude Code でブラッシュアップ → 違和感ベースで対話修正
- 仕様書の画面要素列挙は「**この情報が画面のどこかにあればいい**」という機能要件であって、レイアウト指定ではない

### B. LLM プロンプトの本体

- `src/prompts/` に集約、ハードコード禁止
- バリエーション比較しやすい構造で管理(プロンプト名 + 入力テンプレート + few-shot)
- 初期版は素朴な要約プロンプトで動かし、現場フィードバックで改善

### C. 地図 UI の操作性

- ピンのドラッグ可否、路線編集 UX、CSV インポートのプレビュー等
- 「最も素朴な Leaflet 標準実装で」進めて、違和感が出たら直す

### 判定基準

> **この決定を後から変えたとき、DB スキーマや API 契約、他コンポーネントへの影響はあるか?**
> - YES → 固める領域。仕様書 or 対話で確認してから進む
> - NO → オープン領域。最素朴実装で進めて、後で対話で詰める

---

## 14. デバッグ・トラブルシューティング

### よくある詰まりどころ

**「Map container is already initialized」**
→ §9-2 の Strict Mode 対策(`map.remove()` のクリーンアップ)

**Edge Function で「Cannot find module」**
→ Deno は `npm:` prefix が必要(例:`import { foo } from 'npm:lodash'`)

**Realtime が届かない**
→ broadcast vs postgres_changes の混同(§9-3)、または subscribe 前に send している

**TTS API が 400 エラー**
→ バイト数超過(8000 byte 上限)、または認証エラー(サービスアカウント鍵を確認)

**Supabase が応答しない / 7日以上ぶりに使った**
→ Free tier の auto-pause。手動で再開、ping cron が動いているか確認

### ログ・モニタリング

- フロントエンド:`console.error` + Vercel logs
- Edge Functions:`console.log` + Supabase ダッシュボード
- DB クエリ:Supabase ダッシュボードの「Logs」「Performance」
- MVP では Sentry 等は導入しない

---

## 15. 参考リンク

- Supabase Edge Functions:https://supabase.com/docs/guides/functions
- Supabase Realtime broadcast:https://supabase.com/docs/guides/realtime/broadcast
- Vertex AI Gemini TTS:https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini-tts
- React Leaflet:https://react-leaflet.js.org/
- HiveMQ Cloud:https://www.hivemq.com/products/mqtt-cloud-broker/
- Termux:Boot:https://wiki.termux.com/wiki/Termux:Boot
- MacroDroid:https://www.macrodroid.com/

---

## 付録 A:変更履歴

| 日付 | 変更内容 |
|---|---|
| 2026-05-01 | 初版作成(機能仕様書 v2 rev3 準拠) |
| 2026-05-01 (rev2) | DB 初期マイグレーション作成に伴う追記:§7 に `metadata`/`settings` 命名規約、§9-3 に車内クライアント DB アクセス経路、§10 に運用前提(サインアップ無効・Service Role の扱い) |
