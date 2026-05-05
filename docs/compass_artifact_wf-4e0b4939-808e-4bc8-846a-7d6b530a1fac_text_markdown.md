# v0 × Next.js 15 / TypeScript strict / shadcn/ui ベストプラクティス調査レポート

## TL;DR
- **v0は「画面ごとの第一稿生成器」として最大限活用し、最終仕上げ・型修正・統合・データ層接続はClaude Code側で行うのが最も効率的**。v0は実質的に Next.js App Router + TypeScript + Tailwind + shadcn/ui に最適化されているため、スタックを正しく宣言し、PRDをProject Sourcesにアップロードしたうえで「画面単位」かつ「データ取得はモック関数で抽象化」と明示することが品質の鍵となる。
- **管理画面（CMS / ラジオ番組編集 / Leaflet地図）と車内クライアント（タブレット常時表示）は別プロジェクト・別チャットで生成し、共通の`globals.css`（テーマトークン）と型ファイル（zodスキーマ + `Database`型のスタブ）をSourcesとして共有する**。Leafletのような`window`依存ライブラリは v0プレビューで描画破綻するため、Map本体を別ファイルに切り出し`dynamic(() => import, { ssr: false })` で読み込む形を最初からプロンプトで指示する。
- **Claude Codeへの引き渡しは `npx shadcn@latest add "https://v0.dev/chat/b/xxxx?token=..."` を起点にし、CLAUDE.md にスタック・ファイル構成・「v0生成コードを編集する際の規律」を明記する**。v0の典型的な落とし穴（`any`の混入、1ファイル肥大化、`use client` の過剰付与、`Math.random()`/`new Date()` によるhydrationエラー、Pages Router用イディオムの混入）はClaude Code側でリファクタすることを前提に、v0では「動く見た目」を優先する。

---

## Key Findings

1. **v0 のデフォルトは Next.js App Router + Tailwind + shadcn/ui + Lucide Reactで固定**。リバースエンジニアリングされたシステムプロンプトでも `v0 defaults to Next.js App Router; other frameworks may not work in the v0 UI` と明示されており、React Router DOMやAngularは公式にサポート外（プレビューがブロックされる事例あり）。
2. **v0は「ファイル名 kebab-case」「`import type` を強制」「Tailwindの`bg-primary`等のCSS変数ベース色のみ使用」「画像は`/placeholder.svg?height=&width=`」など、独自の暗黙ルール**で生成する。そのため受け側プロジェクトの `components.json`（shadcn）やTailwind v4設定が一致していないと、shadcn add時に警告・上書きが発生する。
3. **v0のPRD設計フローはドキュメントに公式手順がある**。Sourcesに PDF / TXT / コードファイルをアップロードでき、Project内のチャットはこのSourcesを参照して生成する。仕様書ベースで開発する場合はここに最初の仕様書とCSSトークンを置くのが正解。
4. **エクスポート手段は3種**：(a) `npx shadcn@latest add "https://v0.dev/chat/b/<ID>?token=<TOKEN>"`（推奨。registry経由で既存プロジェクトに直接インストール）、(b) GitHub接続による双方向同期、(c) ZIPダウンロード。Claude Codeに渡す場合は (a) が最もコンフリクトが少ない。
5. **v0生成物の典型的な不具合**：(i) 全ロジックを1ファイルに詰め込みがち（システムプロンプトに `v0 MUST include all components and hooks in ONE FILE` と明記がある）、(ii) Server/Client境界の判定ミス（`useState`を持つコンポーネントに`'use client'`を付け忘れる、または逆に過剰付与）、(iii) `Math.random()` や `new Date()` の使用によるhydration mismatch、(iv) Leaflet/Chart.js等の`window`依存をServer Componentから直接importしてビルドが落ちる、(v) `any` 型と`@ts-ignore`の混入で strict ビルドが通らない。
6. **Leaflet（react-leaflet）はNext.js App Routerで必ず `dynamic(() => import('@/components/Map'), { ssr: false })` で読み込み、Map本体には `'use client'` を付ける**。マーカーアイコンは `delete L.Icon.Default.prototype._getIconUrl` 後にmergeOptionsで再設定するか、`leaflet-defaulticon-compatibility` を使う必要がある。React 19系では `MapContainer is already initialized` エラーが既知。
7. **shadcn/uiの公式 Sidebar / Dashboard ブロック（`sidebar-01`〜`sidebar-15`、`dashboard-01`等）が2024年後半以降の標準**で、v0は内部的にこのブロックを再生成する傾向がある。`SidebarProvider` + `SidebarTrigger` を持つ collapsible パターンは管理画面の事実上のデファクト。
8. **タブレット常時表示UIはPWA + standalone manifest + iPadOSのGuided Access（またはAndroid Kiosk Browser）の組み合わせ**が業界標準。`display: "standalone"` と `orientation` を manifest で固定し、Service Worker（`@ducanh2912/next-pwa` 等）でオフラインフォールバックページを実装するのが定石。
9. **Claude Codeとv0の連携は2系統**：(a) MCPサーバ（Composio製または `hellolucky/v0-mcp`）でClaude Codeから直接v0チャットを生成・取得する方式、(b) 単純にv0で作成→`npx shadcn add`でローカルに取り込み、Claude CodeはローカルファイルとCLAUDE.mdを参照しながら統合する方式。本ユースケース（仕様書既存・初期コード化）では (b) のほうがブラックボックス化を防げて推奨。

---

## Details

### 1. v0への指示（プロンプト）の書き方

#### 1.1 プロンプトの基本構造（Vercel公式 "How to prompt v0" のフレームワーク）

Vercel公式が提示しているのは次の3要素テンプレート：

```
Build [product surface: components, data, actions].
For [user persona + context of use].
With these constraints: [tech stack / styling / non-goals].
```

**業務用管理画面用の推奨テンプレート（日本語例）**：

```
# Stack（最重要・最初に明示）
Next.js 15 App Router / TypeScript strict mode / Tailwind CSS v4 / 
shadcn/ui / Lucide React / React Server Components前提
src/ ディレクトリ構成、@/* path alias、ファイル名は kebab-case。

# 画面
ラジオ番組編集ダッシュボード。左に collapsible Sidebar（shadcn の Sidebar ブロック）、
上部に Header（検索・ユーザーメニュー）、メインに番組一覧テーブル。

# データ
データ取得はすべて lib/api/programs.ts の `getPrograms()` というモック関数で抽象化し、
内部では setTimeout で 300ms 待ってからハードコードした配列を返す。
zod スキーマ `programSchema` と `type Program = z.infer<typeof programSchema>` を
types/program.ts に定義し、コンポーネントは Program 型を受け取る Props にする。

# TypeScript
- すべての関数引数・戻り値に明示的な型を付ける
- any / @ts-ignore / @ts-expect-error は禁止
- Props 型は `interface XxxProps` ではなく `type XxxProps = {...}` で定義
- import type を使い分ける

# 非要件（重要）
- 認証ロジックは生成しない（後で追加する）
- API Routes / Server Actions は今回は不要
- 実際のフェッチ呼び出しは書かない
```

**ポイント**：
- 公式ブログのA/Bテストでは「コンテキストありプロンプト」は26秒長くかかるが「機能の漏れ」と「再プロンプト1〜2回」を削減でき、トータルで速い、と報告されている。
- `bg-primary` などのTailwind CSS変数ベースの色を強制したい場合は、最初に `globals.css` を Sources にアップロードする（後述）。

#### 1.2 shadcn/ui + Tailwind + App Router を正確に指示する書き方

リバースエンジニアリング済みのv0システムプロンプトには次のルールが既に内蔵されている：

- ファイル名は kebab-case (`program-list.tsx`)
- 色は `bg-primary` / `text-primary-foreground` 等のCSS変数ベースを使用、indigo/blue は明示しない限り使わない
- shadcn/ui コンポーネントは自動的に React Project 内に展開される
- 環境変数はサーバ側のみ
- import type を使う

つまり「shadcn/uiで」「App Routerで」と書くのは半分redundant。**むしろ強調すべきは「shadcn既存ブロック（例：`sidebar-07`、`dashboard-01`）に倣って」と既存の構造を参照させること**。これはshadcnブロックがv0の学習データの中核だからである。

#### 1.3 TypeScript strict modeを意識した指示

v0は依然として `any` を時折挿入するため、明示的に禁止する必要がある。プロンプト末尾の「Coding rules」セクションに以下を入れると効果が高い：

- `tsconfig.json` は `"strict": true`、加えて `noUncheckedIndexedAccess` と `exactOptionalPropertyTypes` 有効
- すべての関数・コールバックに型アノテーション
- `any`、`unknown`への雑なキャスト、`@ts-ignore` を禁止
- イベントハンドラは `React.ChangeEvent<HTMLInputElement>` 等具体的に
- 配列map等のインデックスアクセスは存在チェックを行う（`noUncheckedIndexedAccess` 対応）
- `Props`型は `Readonly<>` でラップ、子要素は `React.ReactNode`

それでも残る `any` はClaude Code側で自動修正するのが現実解（後述）。

#### 1.4 データ取得をスタブにしてもらう指示

これがコツ。**「fetchを書くな」と否定形で書くより、「stub関数を経由しろ」と具体的に正の指示を出す方が安定する**：

```
データ層は以下のディレクトリ構成にしてください：
- lib/api/<resource>.ts  : サーバ側相当のスタブ関数
- lib/types/<resource>.ts: zod schema と inferred type
- lib/mocks/<resource>.ts: ハードコードされたモック配列（10件程度）

各 page.tsx / Server Component は次のように書いてください：
  const programs = await getPrograms()
ここで getPrograms() は async 関数だが、内部実装は
  await new Promise(r => setTimeout(r, 200))
  return mockPrograms
としてください。後日 Supabase 呼び出しに差し替えます。

クライアント側で更新が必要な操作（作成・編集・削除）は、
楽観的UIのために useState + 上記モック配列のシャローコピーで完結させ、
fetch / supabase-js 等の実際の呼び出しは絶対に書かないでください。
```

このパターンの優位性：(a) Claude Codeが後で `getPrograms()` の中身だけSupabase呼び出しに置き換えれば済む、(b) 型は zod スキーマで固定されるためバックエンド差し替え時の壊れ方が局所化される、(c) v0プレビューでもデータ表示が動く。

#### 1.5 Leaflet（地図UI）の生成指示

Leafletはv0が最も苦手な領域の1つ。**理由は (i) `window` 依存でSSR時に落ちる、(ii) v0のプレビュー環境はサンドボックスでiframe禁止やCSP制約があり、外部タイル（OpenStreetMap）が読めないことがある**。

推奨プロンプト戦略：

```
地図UIは以下の構造で生成してください：

1. components/map/leaflet-map.tsx (Map実体)
   - 先頭に 'use client'
   - import 'leaflet/dist/leaflet.css'
   - import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
   - import 'leaflet-defaulticon-compatibility'
   - useEffect 内で L.Icon.Default を mergeOptions
   - MapContainer / TileLayer / Marker / Popup を配置
   - props 型を厳密に定義 (LatLngTuple / LatLngExpression を使用)

2. components/map/map.tsx (動的importラッパー)
   - 'use client' なし（Server Component）
   - dynamic(() => import('./leaflet-map'), { ssr: false, loading: () => <MapSkeleton/> })
   - 親から受け取る props を素通し

3. app/(admin)/map/page.tsx で <Map /> を使用

タイル URL は https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png を仮で設定。
center / zoom はProps化してください。
```

**注意**：v0プレビュー上では地図が真っ白／タイルが描画されない場合があるが、Claude Code側でローカル起動するとほぼ動く。プレビューが壊れていてもエクスポートを諦めないこと。

#### 1.6 複数画面を段階的に生成する戦略

公式ドキュメントは「個別コンポーネント単位での反復が最も効率的」と推奨している。また、ある実体験では「v0のチャット内で複数ページを作っても、`Add to Codebase` 時に1ページしか取り込まれなかった」という報告がある。

**推奨する段階的生成フロー**：

| Step | チャット | 内容 |
|---|---|---|
| 0 | 共通 | Project作成 → Sources に仕様書PDF・globals.css・zodスキーマtsをアップロード |
| 1 | Chat A | デザインシステム（layout.tsx・theme・shared header/sidebar）を生成 |
| 2 | Chat B | 管理画面 #1（コンテンツ管理一覧+編集モーダル） |
| 3 | Chat C | 管理画面 #2（ラジオ番組エディタ） |
| 4 | Chat D | 管理画面 #3（地図UI） |
| 5 | Chat E | 車内クライアント（タブレット常時表示） |

各Chatは独立させ、`forkChat`機能で派生バージョンを試す。最後に**Claude Code側で各チャットの成果物を1プロジェクトにマージする**（`shadcn add`を順番に実行→重複コンポーネントは差分レビュー）。

---

### 2. v0生成物の品質を上げるイテレーション手法

#### 2.1 v0チャットでのリファイン

- **Selectモード**：プレビュー上のコンポーネントを直接選択して「これをこう変えて」と日本語で指示できる。位置や色の修正はテキストプロンプトより圧倒的に正確。
- **Fork**：気に入った段階で fork し、別案を試す。バージョン履歴は残るが、線形に上書きすると後戻り困難。
- **Queueプロンプト**：最大10個までプロンプトを先入れできる。「sidebar作って→header作って→ダッシュボード作って」と段階的に投げられる。
- **「最後に動作確認して」プロンプト**：1セッションの終盤で `Review the generated code for hydration risks (Math.random, new Date in render), missing 'use client' directives, and any/@ts-ignore usage. Fix all of them.` と投げると一定の効果がある。

#### 2.2 どこまでv0で仕上げるか（境界線）

**v0で完了させるべきこと**：
- レイアウト（grid/flex、ブレークポイント）
- shadcnコンポーネントの組み合わせとprops構成
- Tailwindクラスによるvisualデザイン
- 静的なナビゲーション構造
- ハードコードされたモックデータの埋め込み
- 基本的なフォーム構造（react-hook-form + zod）

**Claude Code側に持ち越すべきこと**：
- 1ファイル肥大化したコンポーネントの分割（v0は1ファイル詰め込みがち）
- `any`型・`@ts-ignore`の除去
- 真のServer/Client境界の最適化（v0はやや過剰に`use client`を付与する）
- データ層（Supabaseクライアント、Server Actions、route handlers）
- 認証 / ミドルウェア / RLS連携
- エラーバウンダリ・loading.tsx・error.tsxの整備
- アクセシビリティ精査（focus-visible、ARIA、キーボードナビ）
- テスト（Playwright / Vitest）
- 国際化（next-intl 等）

経験則として **「ピクセル」と「shadcn部品の選定」までがv0の責務、「型」と「データ」と「副作用」がClaude Codeの責務**。

#### 2.3 v0生成コードの典型的な落とし穴

| 問題 | 症状 | 修正方針 |
|---|---|---|
| 1ファイル肥大化 | 1つの`.tsx` が500行超 | Claude Codeで `components/<feature>/<atom>.tsx` に機械的分割 |
| `'use client'` 過剰 | Server Componentで使えるはずの部分も client化 | データfetch部分だけServer、interactive部分のみClientに分離 |
| `any` 混入 | strict ビルドで `noImplicitAny` エラー | zodスキーマ起点で `z.infer` 型に置換、unknownにキャスト後ガード |
| hydration mismatch | `Math.random()`、`new Date()`、`window`参照 | `useEffect` + `useState` で client-only に隔離 |
| react-leaflet SSR エラー | `window is undefined` | dynamic + `ssr: false` ラッパー必須 |
| Pages Routerイディオム | `getServerSideProps` / `next/router` の混入 | `next/navigation` の `useRouter`、Server Component fetch に書き換え |
| React Router DOM | v0が稀に挿入する | プロンプトで明示的に「Next.js App Routerのみ、react-routerは使用禁止」と書く |
| 古いshadcn API | 旧バージョンの`SidebarTrigger`API使用 | `npx shadcn@latest add sidebar` で最新版に上書き |
| Tailwindクラスのarbitrary値多用 | デザイントークンを無視した `bg-[#3b82f6]` | globals.css のCSS変数を強制 |

---

### 3. Claude Codeへのスムーズな引き渡し

#### 3.1 取り込みコマンド

最も推奨される取り込み方法：

```bash
# 既存のNext.js 15 + shadcn初期化済みプロジェクトのルートで実行
npx shadcn@latest add "https://v0.dev/chat/b/<CHAT_ID>?token=<TOKEN>"
```

このコマンドは、v0が生成したコンポーネント・依存shadcn部品・必要npmパッケージをすべて自動で展開し、`components.json` のエイリアスに従って正しいパスに配置する。Monorepoでも `apps/web` から実行すれば `packages/ui` に正しく振り分けられる。

新規プロジェクトを v0 から立ち上げる場合：

```bash
# v0のチャット画面の "Add to Codebase" ボタンが生成するコマンド
npx create-next-app@latest my-app --typescript --tailwind --app --src-dir
cd my-app
npx shadcn@latest init   # presetを選択
npx shadcn@latest add "https://v0.dev/chat/b/<CHAT_ID>?token=<TOKEN>"
```

#### 3.2 引き渡し前の事前整理（v0側で済ませておくこと）

v0チャットの最後に投げる「整理プロンプト」例：

```
最終出力の前に以下を整理してください：
1. すべての mock データを lib/mocks/*.ts に集約
2. すべての型を types/*.ts に切り出し
3. shadcn/ui のコンポーネントは絶対に書き換えず、@/components/ui/* から import するのみ
4. ページ用コンポーネントは app/, ドメインコンポーネントは components/<feature>/ に配置
5. 'use client' は必要最小限のリーフコンポーネントだけに付与
6. すべての import を整理（type imports は import type で）
```

#### 3.3 Claude Codeでのワークフロー（推奨）

**Step 1: CLAUDE.md を整備**

プロジェクトルートに次の内容のCLAUDE.mdを配置（Anthropic公式とHumanLayerのガイドラインを統合）：

```markdown
# Project Stack
- Next.js 15 (App Router, Turbopack), React 19
- TypeScript 5 (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
- Tailwind CSS v4, shadcn/ui (new-york style)
- Supabase (後で接続予定。現時点では lib/api/*.ts のスタブを使用)
- Leaflet + react-leaflet 5 (App Router 互換のためdynamic + ssr:false 必須)

# File Layout
- app/(admin)/...        # 管理画面（CMS / 番組編集 / 地図）
- app/(client)/...       # 車内クライアント（タブレット常時表示）
- components/ui/         # shadcn 部品。原則編集禁止。
- components/<feature>/  # ドメインコンポーネント
- lib/api/               # データ取得スタブ（Supabase差し替え対象）
- lib/mocks/             # モック配列
- lib/types/             # zod schema + inferred types
- public/manifest.json   # PWA manifest（車内クライアント用）

# Coding Rules
- any / @ts-ignore / @ts-expect-error は禁止。やむを得ない場合はTODOコメント+Issue化。
- 関数引数・戻り値は明示的な型を持つ
- React Server Component が原則。'use client' はリーフのみに付ける。
- `Math.random` / `Date.now` を render 中で呼ばない（hydration mismatch対策）
- Leafletはdynamic + ssr:false ラッパー経由でのみ import

# v0 Integration Notes
- v0で生成したコンポーネントは components/<feature>/_v0/ に一旦置く
- そこから手動で分割し、最終的には _v0/ ディレクトリは削除する
- shadcn add は許可。npm install 系も許可。

# Workflow
- 機能追加前に Plan モードで設計を提示
- 完了後は `pnpm typecheck && pnpm lint` を必ず通す
- v0の挙動変更は必ず人間レビューを挟む

# Commands
- pnpm dev / pnpm build / pnpm typecheck / pnpm lint / pnpm test
```

CLAUDE.mdは200行以内に収め、詳細な規約は別ファイル（`docs/coding-style.md`）に分離して `@docs/coding-style.md` のように参照する形が公式推奨。

**Step 2: v0生成物のリファクタを依頼**

```
v0 で生成した components/admin/program-editor.tsx を以下のルールでリファクタしてください：
- 1ファイル500行以上の場合、論理単位でファイル分割
- すべての any を具体的な型に置換（types/program.ts の zod から派生）
- 'use client' を必要最小限に
- データ取得は lib/api/programs.ts の getPrograms() / updateProgram() 経由に統一
- pnpm typecheck がエラーゼロで通ることを最終確認

完了後、何を変更したかをサマリしてください。
```

**Step 3: Supabase接続フェーズへ**

`lib/api/programs.ts` の中身だけをSupabaseクライアント呼び出しに置き換える。zod schemaはそのまま `Database['public']['Tables']['programs']['Row']` 型と整合させる。UIは一切触らない。

#### 3.4 v0 MCP（オプション）

`hellolucky/v0-mcp` または Composio の v0 MCP サーバを使うと、Claude Code内から `v0_generate_ui` ツールでv0チャットを直接呼べる。ただし**仕様書ベースの本格開発では、ブラウザのv0 UIで人間がプレビューを目視確認しながら作るほうが質が高い**。MCPは「Claude Codeが既存コードに似たコンポーネントの追加生成を依頼したい」という二次的なユースケースで真価を発揮する。

---

### 4. 業務用管理画面・タブレットUIに特有の考慮事項

#### 4.1 ダッシュボードレイアウトの生成パターン

shadcn/ui の `Sidebar` コンポーネント（2024年末に追加）が事実上のデファクト。本番投入されているOSSダッシュボード（`arhamkhnz/next-shadcn-admin-dashboard`、`salimi-my/shadcn-ui-sidebar`等）はいずれも以下の構造：

```
app/
├── (auth)/
│   ├── layout.tsx          # 認証用の中央寄せレイアウト
│   └── login/page.tsx
├── (admin)/
│   ├── layout.tsx          # SidebarProvider + AppSidebar + Header
│   ├── programs/page.tsx
│   ├── content/page.tsx
│   └── map/page.tsx
└── (client)/
    ├── layout.tsx          # フルスクリーン・サイドバーなし
    └── page.tsx
```

**推奨v0プロンプト**：「shadcn の `sidebar-07` ブロックを参考に、collapsible="icon"、SidebarTrigger をHeaderに配置、breadcrumb 連動」。

ルートグループ `(admin)` を使うことでURL構造を変えずに各セクションでlayoutを切り替えられる。これが管理画面と車内クライアントの**完全分離レイアウト**を実現する鍵。

#### 4.2 タブレット常時表示UI（車内クライアント）の設計

業務的要件に対するベストプラクティス：

**(a) PWA + standalone manifest を必須化**

```json
// public/manifest.json
{
  "name": "車内クライアント",
  "short_name": "InCar",
  "display": "standalone",
  "orientation": "landscape",  // 車載は横固定が一般的
  "start_url": "/client",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [...]
}
```

**(b) Service Workerでオフラインフォールバック**

`@ducanh2912/next-pwa` を使い、`/offline` ページを事前キャッシュ。Fishtank記事のパターン：
- `useNetworkStatus` フック で online/offline 監視
- offline時はモーダル表示、retry ボタン付き
- 復帰時は自動的にモーダルを閉じる

**(c) viewport固定とユーザ操作の制限**

```typescript
// app/(client)/layout.tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
}
```

CSSで `overscroll-behavior-y: contain` を設定して引き下げリロードを抑制。`-webkit-tap-highlight-color: transparent` でタップハイライトを消す。

**(d) iPad/Androidのキオスクモード**

iPadなら**Guided Access（アクセシビリティ設定）**でPWAをロック、Androidなら**Kiosk Browser Lockdown**等のアプリでChromeをラッパー化、というのがBornfightの実例。アプリ側でできることは：
- 全画面化（manifestの`standalone`）
- スリープ抑制（Wake Lock API）
- 自動再描画/再接続ロジック（push通知またはServer-Sent Eventsで強制リロード）

**(e) v0プロンプト追加事項**

```
タブレット常時表示の車内クライアント画面を作成。
- 画面サイズは 1280x800 横向き固定を主ターゲット
- フォントサイズはやや大きめ（運転席から見える距離）、最小 18px
- タッチターゲットは 44x44px 以上
- アニメーションは控えめに（60fps維持）
- カラースキームは長時間表示でも疲れない暗めのトーン
- 画面端から 24px 以上のセーフエリアマージン（画面焼けにも配慮）
- 上部に常時表示の「現在再生中」バー、中央に番組情報、下部にステータス
```

#### 4.3 Leaflet地図UIをv0で扱う具体的な方法

**生成戦略**：

1. **v0でMap実体だけ作らせる**：MapContainer + TileLayer + Marker のみ。dynamic import ラッパーは無理に作らせない。
2. **Claude Code側でラッパーを追加**：

```typescript
// components/map/map.tsx
import dynamic from "next/dynamic"
import type { ComponentProps } from "react"
import type LeafletMap from "./leaflet-map"

const DynamicMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted animate-pulse" />,
})

export type MapProps = ComponentProps<typeof LeafletMap>
export default function Map(props: MapProps) {
  return <DynamicMap {...props} />
}
```

```typescript
// components/map/leaflet-map.tsx
"use client"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import "leaflet-defaulticon-compatibility"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import type { LatLngExpression } from "leaflet"

type Props = {
  center: LatLngExpression
  zoom?: number
  markers?: { id: string; position: LatLngExpression; label?: string }[]
}

export default function LeafletMap({ center, zoom = 13, markers = [] }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker key={m.id} position={m.position}>
          {m.label && <Popup>{m.label}</Popup>}
        </Marker>
      ))}
    </MapContainer>
  )
}
```

3. **既知の落とし穴の回避**：
   - `MapContainer is already initialized` エラー（React 19 + StrictMode）：StrictModeを開発時に無効化するか、`MapContainer`を`React.memo`で囲い`key`プロパティで明示的に再マウント制御する。
   - マーカーアイコン未表示：`leaflet-defaulticon-compatibility`を入れるのが最も安定。
   - SSR時のCSS未読み込み：`leaflet/dist/leaflet.css`はクライアントコンポーネント側でimport（Server Componentからimportするとビルドが落ちることがある）。
   - 高さ未指定で表示されない：必ず親要素に高さを与える（`h-screen`や`h-[480px]`等）。

4. **オフラインタイル対応**（車内クライアント要件次第）：`public/tiles/` に事前ダウンロードしたタイルを配置し、`url="/tiles/{z}/{x}/{y}.png"`に切り替える。Service Workerで `/tiles/*` をキャッシュ。

---

## Recommendations

以下の段階的ロードマップで進めることを推奨する。各ステージには次に進むためのベンチマークを設定した。

### Stage 1（1日目）: 基盤整備
1. **新規Next.js 15プロジェクトを作成**：`npx create-next-app@latest --typescript --tailwind --app --src-dir`
2. **shadcn初期化**：`npx shadcn@latest init`（preset: nova または vega、base color はプロジェクトに合わせる）
3. **CLAUDE.md作成**（上記§3.3 のテンプレートを使用）
4. **`tsconfig.json` を strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes に**
5. **zodスキーマと型のスケルトンを作成**（仕様書をClaude Codeに読ませて生成）
6. **v0 Project を2つ作成**（管理画面用 / 車内クライアント用）、Sourcesに仕様書PDFと`globals.css`をアップロード

→ **次のステージへの判断基準**：`pnpm dev` が動き、CLAUDE.mdが200行以内に収まり、zod schemaが Supabase の予定スキーマと整合している。

### Stage 2（2〜3日目）: v0で画面生成
1. **共通レイアウトを生成**（Sidebar + Header + ルートグループ構造）
2. **管理画面を1画面ずつ別Chatで生成**：CMS一覧 → 編集モーダル → ラジオ番組エディタ → 地図UI
3. **車内クライアントを別Project・別Chatで生成**：viewport固定・大きめフォント明示
4. 各Chatの最後に `npx shadcn@latest add "..."` でローカル取り込み

→ **判断基準**：すべての画面がプレビュー上で破綻なく表示でき、ローカル `pnpm build` が（型エラーがあっても）warning レベルで通過する。

### Stage 3（4日目）: Claude Codeでリファクタ
1. **`pnpm typecheck` を通す**：Claude Codeに「すべての any を排除し、ファイルを論理単位で分割」と依頼
2. **Server/Client境界を最適化**：「`'use client'` を最小化、Server ComponentからStub関数 await」
3. **Leafletラッパーを差し込む**：dynamic import パターンに統一
4. **PWA manifest と Service Worker を追加**（車内クライアントのみ）
5. **`pnpm lint` を通す**

→ **判断基準**：`pnpm typecheck && pnpm lint && pnpm build` がすべて zero error で通過、Lighthouse PWAスコアが90以上（車内クライアントのみ）。

### Stage 4（5日目以降）: Supabase接続
1. **`lib/api/*.ts` のスタブ関数の中身だけ Supabase クライアント呼び出しに置換**
2. **UIは一切変更しない**（型さえ整合していればpropsレベルで影響しない）
3. **RLS（Row Level Security）とミドルウェア認証を追加**
4. **Playwright で主要フローのE2Eテストを書く**

→ **判断基準**：モック動作とSupabase接続後動作で表示・操作が同一。

### 方針を変更すべきベンチマーク
- **v0生成物が80%以上のケースで使い物にならない場合** → プロンプトに具体的な参考UI（既存サイトのスクリーンショットや shadcn の特定ブロック名）を必ず含める運用に切り替える。
- **Leafletプレビューが常に壊れる場合** → v0で地図UIを作るのを諦め、Claude Codeに最初から書かせる（地図はテキスト指示で書ける程度に定型）。
- **Claude Codeでのリファクタコストがv0生成時間を超える場合** → v0は「最初の画面構造のたたき台」だけにとどめ、2画面目以降はClaude Code内で同パターンを横展開させる。

---

## Caveats

1. **v0は2024〜2025年に大きな仕様変更を繰り返している**。本レポートで引用したシステムプロンプト（`v0 MUST include all components and hooks in ONE FILE` 等）は2024年11月時点のリバースエンジニアリング結果であり、2026年5月時点では一部挙動が変わっている可能性がある。本番採用前にv0公式ドキュメント（`v0.app/docs`）の最新版を確認すべき。

2. **v0の生成コードに対するライセンスはVercel側に保留されている**：FAQに `Vercel doesn't own the code generated based on your queries and prompts. However, output that you receive may be the same or similar to other users' output or third party's IP, be incomplete or contain bugs` と明記されている。商用利用前にコードレビューと法的確認が必要。

3. **v0 EnterpriseでないプランではプロンプトとアウトプットがVercelの学習データに使われる可能性がある**。社内仕様書をSourcesにアップロードする場合は機密情報が含まれていないことを確認、または Enterprise プラン契約を検討。

4. **Leafletのdynamic import パターンはNext.js 15 + React 19の組み合わせで `MapContainer is already initialized` エラーが報告されている**（2025年時点のreact-leaflet GitHub issue #1133）。本番投入前に最新版での再現確認を推奨。代替として `maplibre-gl` / `@vis.gl/react-leaflet` 等の検討も。

5. **shadcn/ui の Sidebar API は2024年末以降のバージョンでも非互換変更が複数回入っている**。v0が古いAPI（旧 `Sidebar` Layout）を生成する場合があるため、生成後は必ず `npx shadcn@latest add sidebar` で最新版に上書きする。

6. **v0 MCP サーバ（hellolucky/v0-mcp、Composio）は第三者製で、認証情報の取り扱いに注意**。本番開発で使う場合はソースコードを確認するか、Vercelの公式統合（リリースされていれば）を待つほうが安全。

7. **本レポートで引用した `claudefa.st` の「Claude Design」関連記述は2026年時点のClaude公式の新機能の可能性があるが、未検証**。Claude DesignがClaude Codeへの直接ハンドオフを提供している場合、v0よりこちらの利用を検討する余地がある。最新のAnthropic公式発表を確認のこと。

8. **タブレット運用時の物理的問題**（画面焼け、熱、Wi-Fi断、車載電源のサージ等）はソフトウェアでは完全には解決できない。OSレベルのキオスク管理（MDM、JAMF、Android Enterprise）と組み合わせる前提で設計すること。