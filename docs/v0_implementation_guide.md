# v0 実装手順書 — autodj_radio

v0ベストプラクティス調査結果 × これまでの設計議論を統合した実装手順。
**今夜着手するための具体的な順番。**

---

## 全体の役割分担（先に頭に入れる）

| 担当 | やること |
|---|---|
| v0 | UIのレイアウト・デザイン・shadcnコンポーネント選定・モックデータ表示 |
| Claude Code | 型修正・ファイル分割・Supabase接続・Leafletラッパー・認証・RLS |

**境界線の原則**：「ピクセルとshadcn部品の選定」まではv0。「型・データ・副作用」はClaude Code。

---

## Phase 1: v0 Project のセットアップ（15分）

### 1-1. v0 Project を2つ作る

`v0.dev` にログイン → 「New Project」

| Project名 | 用途 |
|---|---|
| `autodj_radio_admin` | 管理画面（コンテンツ管理・番組編集・地図UI） |
| `autodj_radio_client` | 車内クライアント（タブレット常時表示） |

2つに分ける理由：管理画面とタブレットUIはレイアウト・フォントサイズ・カラートーンが全然違う。同じProjectで作ると混乱する。

### 1-2. Sources に以下をアップロード（各Projectに）

| ファイル | 内容 |
|---|---|
| `v0_spec.md` | このプロジェクト用のv0向けUI仕様書（作成済み） |
| `globals.css` | Tailwindテーマトークン（shadcn init後に生成されたもの） |
| `zod_schemas.ts` | 型のスケルトン（下記参照） |

機密情報の注意: v0のProプランではプロンプトが学習データに使われる可能性がある。固有のクライアント情報は伏せる。

### 1-3. zod_schemas.ts を作って渡す

以下を `zod_schemas.ts` として保存してSourcesにアップロード：

```typescript
import { z } from 'zod'

export const contentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string().optional(),
  sourceType: z.enum(['polling', 'manual', 'url']),
  tags: z.array(z.string()),
  audioStatus: z.enum(['pending', 'generating', 'generated', 'error']),
  radioRegistered: z.boolean(),
  scriptText: z.string().optional(),
  audioDurationSec: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Content = z.infer<typeof contentSchema>

export const programSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  enabled: z.boolean(),
  routePoints: z.array(z.object({ lat: z.number(), lng: z.number() })),
  items: z.array(z.object({
    id: z.string().uuid(),
    position: z.object({ lat: z.number(), lng: z.number() }),
    locationName: z.string(),
    contentTitle: z.string(),
    audioDurationSec: z.number(),
  })),
  updatedAt: z.string(),
})
export type Program = z.infer<typeof programSchema>

export const pollingSiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  enabled: z.boolean(),
  lastFetchedAt: z.string().optional(),
  lastStatus: z.enum(['success', 'error', 'pending']).optional(),
})
export type PollingSite = z.infer<typeof pollingSiteSchema>
```

---

## Phase 2: 管理画面の生成（今夜のメイン）

### 生成順序

| Step | Chat | 画面 |
|---|---|---|
| A | 共通レイアウト | Sidebar + Header（全管理画面の骨格） |
| B | コンテンツ管理 | 一覧 + 編集画面 |
| C | ラジオ番組 | 一覧 + 編集画面 |
| D | 地図UI | Claude Codeで追加（v0では作らない） |
| E | ポーリングサイト管理 | 一覧 |

1チャット=1画面が鉄則。複数画面を1チャットで作ると「Add to Codebase」で1画面しか取り込まれない既知の問題がある。

---

### Step A: 共通レイアウト

```
# Stack
Next.js 15 App Router / TypeScript strict mode / Tailwind CSS /
shadcn/ui / Lucide React / src/ ディレクトリ構成 / @/* path alias / ファイル名 kebab-case

# 作るもの
管理画面の共通レイアウト。
shadcn の sidebar-07 ブロックを参考に、collapsible="icon" の Sidebar を持つ管理画面レイアウト。

- app/(admin)/layout.tsx : SidebarProvider + AppSidebar + Header を配置
- components/admin/app-sidebar.tsx : サイドバー本体
  ナビ項目: コンテンツ管理(/contents) / ラジオ番組(/programs) / ポーリングサイト(/polling-sites)
  アイコン: Lucide の FileText / Radio / Globe
- components/admin/header.tsx : ページタイトル + SidebarTrigger

# TypeScript ルール
- any / @ts-ignore 禁止
- Props型は type XxxProps = {...} で定義
- import type を使い分ける

# 非要件
- 認証ロジック不要 / データ取得不要 / API Routes不要
```

---

### Step B: コンテンツ管理画面

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / src/ 構成

# 作るもの

1. コンテンツ一覧 app/(admin)/contents/page.tsx
- shadcn の Table でコンテンツ一覧表示
- カラム: タイトル / ソースタグ(Badge) / 音声ステータス(Badge) / ラジオ登録(Badge) / 更新日 / 操作
- 上部にキーワード検索Input + ソース種別フィルタ(Select)
- 右上に「新規作成」Button

2. コンテンツ編集 app/(admin)/contents/[id]/page.tsx
- タイトル入力
- 元テキストエリア（大きめ）
- 「AIで台本化」Button（クリック中はローディングスピナー）
- 台本テキストエリア（編集可、右下にバイト数カウンター、4000バイト超で赤表示）
- タグ入力
- 音声セクション: ステータス表示 + 「音声を生成」Button + audio プレイヤー（生成済み時のみ）
- 保存Button

# データ
型はSourcesの zod_schemas.ts の Content を使用。
lib/api/contents.ts にスタブ関数（getContent, updateContent）を定義。
内部は await new Promise(r => setTimeout(r, 200)) + モックデータを返す。
モックは lib/mocks/contents.ts に10件。
作成・更新・削除はconsole.logのみのスタブ。
fetch / supabase-js は一切書かない。

# TypeScript ルール
- any / @ts-ignore 禁止
- use client は必要最小限（フォームやインタラクションがあるコンポーネントのみ）

# 非要件
- 認証不要 / fetch・supabase呼び出し不要 / Server Actions不要
```

---

### Step C: ラジオ番組管理画面

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / src/ 構成

# 作るもの

1. 番組一覧 app/(admin)/programs/page.tsx
- shadcn Table で番組一覧
- カラム: 番組名 / コンテンツ数 / 有効/無効(Switch) / 更新日 / 編集Button
- 右上に「新規作成」Button

2. 番組編集 app/(admin)/programs/[id]/page.tsx
レイアウト: 左60%に地図エリア、右40%に設定パネル

右パネル:
- 番組名入力
- 有効/無効 Switch
- 「路線データCSVインポート」Button（ファイル選択のみ、処理はスタブ）
- 紐付けセット一覧(Table): 位置名称 / コンテンツタイトル / 音声長 / 削除Button
- 保存Button

左の地図エリア（重要）:
地図は以下のプレースホルダーdivでOK。Leafletは別途Claude Codeで追加するため実装不要。
<div className="h-full w-full bg-muted flex items-center justify-center rounded-lg">
  <p className="text-muted-foreground text-sm">地図（Leaflet）がここに入ります</p>
</div>

# データ
Sourcesの zod_schemas.ts の Program を使用。
lib/api/programs.ts にスタブ（getPrograms, getProgram, updateProgram）。
lib/mocks/programs.ts に3件。

# TypeScript ルール・非要件（Step Bと同じ）
```

---

### Step D: Leaflet 地図コンポーネント（Claude Codeで対応）

v0では作らない。Step C完了後、Claude Code に以下を依頼する：

```
components/map/ に Leaflet 地図コンポーネントを追加してください。

構成:
- components/map/leaflet-map.tsx : Map実体（'use client'付き）
- components/map/map.tsx : dynamic importラッパー（ssr: false）

要件:
- leaflet-defaulticon-compatibility でマーカーアイコン問題を解決
- Props: center(LatLngExpression) / zoom(number, default 13) /
  routePoints(LatLngExpression[]) / markers({id, position, label, color}[])
- 路線はPolylineで表示、マーカーは色分け対応（再生済み=グレー/待機中=青/再生中=緑）
- 親要素の高さに合わせてh-fullで展開

完了後、app/(admin)/programs/[id]/page.tsx の地図プレースホルダーをこのコンポーネントに差し替えてください。
```

---

### Step E: ポーリングサイト管理

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / src/ 構成

# 作るもの
ポーリングサイト管理画面 app/(admin)/polling-sites/page.tsx

- shadcn Table で一覧表示
- カラム: サイト名 / URL / 有効/無効(Switch) / 最終取得日時 / ステータス(Badge) / 削除Button
- 右上に「追加」Button → shadcn Dialog でURL・サイト名入力フォーム

# データ
Sourcesの zod_schemas.ts の PollingSite を使用。
lib/api/polling-sites.ts にスタブ。
lib/mocks/polling-sites.ts に5件。

# TypeScript ルール・非要件（Step Bと同じ）
```

---

## Phase 3: 車内クライアントの生成

`autodj_radio_client` Project で生成。管理画面が一通り終わってから。

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / src/ 構成

# ターゲット
タブレット（1280x800 横向き固定）の常時表示画面。

# デザイン方針
- フォントサイズ最小 18px
- タッチターゲット 44x44px 以上
- カラースキームは暗めのトーン（長時間表示に配慮）
- アニメーション控えめ
- 画面端から 24px 以上のマージン

# 作るもの（3画面）

1. 番組選択 app/(client)/page.tsx
- 番組をカードで表示（大きめ）
- 番組名・コンテンツ数・有効状態
- カードタップで /client/confirm に遷移

2. 番組確認 app/(client)/confirm/page.tsx
- 番組名（大きく）
- 登録コンテンツ一覧（位置名称 / タイトル）
- GPS状態インジケーター（受信中=緑 / 未受信=赤 / 精度低下=黄）
- サーバー通信インジケーター（接続中=緑 / 切断=赤）
- 「再生開始」Button（GPS・通信ともに正常のみ有効）

3. 再生モード app/(client)/play/page.tsx
- 上部: 「現在再生中」バー（コンテンツ名 + 残り時間）
- 中央: 地図プレースホルダー（h-[60vh]、Leafletは後でClaude Codeが追加）
- 下部: ステータスバー（GPS / 通信 / キュー数 / 外部音声入力トグル）

共通レイアウト app/(client)/layout.tsx:
- SidebarなしのフルスクリーンLayout
- export const viewport: Viewport = { maximumScale: 1, userScalable: false }

# データ
すべてローカルstateで管理（useState）。APIスタブ不要。

# TypeScript ルール・非要件（管理画面と同じ）
```

---

## Phase 4: ローカルへの取り込み

各チャット完成後に「Add to Codebase」ボタンでコマンドをコピー：

```bash
npx shadcn@latest add "https://v0.dev/chat/b/<CHAT_ID>?token=<TOKEN>"
```

取り込み順序：A → B → C → E → 車内クライアント → 最後にD（Leaflet）

取り込むたびに：
```bash
pnpm typecheck  # エラー確認（今夜は把握するだけでOK）
pnpm dev        # 表示確認
```

---

## Phase 5: Claude Code でリファクタ（翌日以降）

全画面取り込み後に一括依頼：

```
v0で生成したコンポーネントを以下のルールでリファクタしてください：

1. pnpm typecheck を通す（anyの除去、型の明示）
2. 'use client' を必要最小限に絞る
3. 500行超のファイルを論理単位で分割
4. components/map/ にLeafletコンポーネントを追加し、地図プレースホルダーを差し替える
5. pnpm lint を通す

完了後、変更サマリーを出してください。
```

Supabase接続（lib/api/*.ts のスタブを置き換え）はPhase 6以降。

---

## 詰まったとき用

**プレビューで地図が真っ白**
→ 正常。v0のサンドボックスはOSMタイルを読めないことがある。エクスポートして進む。

**shadcn add で警告が出る**
→ 基本は上書きしてOK。Sidebar APIが古い場合は `npx shadcn@latest add sidebar` で上書き。

**型エラーが大量**
→ Phase 5でClaude Codeに一括対応させる。今夜は `pnpm dev` が起動することだけ確認。

**1ファイルが500行超**
→ v0の仕様。Claude CodeのPhaseで分割。今夜は気にしない。

---

## 今夜の目標

- [ ] v0 Project 2つ作成（admin / client）
- [ ] Sources に仕様書・globals.css・zodスキーマをアップロード
- [ ] Step A（共通レイアウト）生成・ローカル取り込み・`pnpm dev` 確認
- [ ] Step B（コンテンツ管理）生成・取り込み
- [ ] 余裕があれば Step C まで

**無理に全部やらない。Step A が動いたら今夜は十分。**
