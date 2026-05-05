# 走り出すまでのチェックリスト

Cursor 上で Claude Code を使って autodj_radio の開発を始めるまでの手順。
**このファイルを上から順にやれば詰まらない。**

詳細が必要な手順は各ドキュメントを参照先として示す。

---

## Phase 0: 前提ツールの確認（5分）

```bash
# バージョン確認（全部通ればOK）
node --version          # v18以上
pnpm --version          # なければ: npm install -g pnpm
supabase --version      # なければ: brew install supabase/tap/supabase (Mac) / scoop install supabase (Win)
claude --version        # v2.1.118以上。古ければ: npm update -g @anthropic-ai/claude-code
git --version
```

> **Cursorとclaude codeの関係**: Claude Code はターミナルで動くCLIツール。Cursor 上でターミナルを開いて `claude` コマンドを叩く。Cursor の AI補完とは別物。

---

## Phase 1: プロジェクト初期化（15分）

### 1-1. Next.js プロジェクト作成

```bash
pnpm create next-app@latest autodj_radio \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir
cd autodj_radio
```

### 1-2. `package.json` の scripts を確認・追記

`package.json` を開いて `scripts` に以下が揃っているか確認。足りなければ追加:

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

### 1-3. shadcn/ui の初期化

**事前にテーマを確認する（任意）**: `ui.shadcn.com/themes` でStyleとBase colorの組み合わせをプレビューできる。管理画面は業務ツール寄りなのでどれでも合う。車内クライアントを暗めにしたいなら **New York + Zinc or Slate** が馴染みやすい。

```bash
pnpm dlx shadcn@latest init
```

対話形式で聞かれる選択肢：
- Style: **New York**（推奨）
- Base color: 好みで（Neutralが無難）
- CSS variables: **Yes**

これで `src/app/globals.css` が更新される。**このファイルをv0のSourcesに渡す**（v0実装ガイド参照）。

### 1-4. 必須ライブラリのインストール

```bash
pnpm add zod leaflet react-leaflet @turf/boolean-point-in-polygon mqtt
pnpm add -D @types/leaflet prettier
```

> 他のライブラリは CLAUDE.md §6 の「追加禁止リスト」を確認してから追加する。

### 1-5. `tsconfig.json` の strict 確認

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

`strict: true` がなければ追加する。

---

## Phase 2: ディレクトリ構造とClaude Code設定ファイル（15分）

> 詳細手順: **SETUP.md §1**

```bash
# ディレクトリを切る
mkdir -p .claude/rules .claude/skills .claude/agents docs src/lib src/schemas src/prompts src/types src/hooks supabase/functions/_shared

# Claude Code 設定ファイルを作る
touch .claude/settings.json
touch CLAUDE.md CLAUDE.local.md
touch docs/data-governance.md docs/supabase-rls-policies.md
```

### 2-1. ファイルを配置

- `CLAUDE.md` → このリポジトリの `CLAUDE.md` をそのままプロジェクトルートにコピー
- `.claude/settings.json` → **SETUP.md §1.5** の内容をそのまま貼る
- `CLAUDE.local.md` → **SETUP.md §1.4** の内容を参考に自分の環境に合わせて書く
- `docs/data-governance.md` → **SETUP.md §1.6** の内容を貼る
- `docs/supabase-rls-policies.md` → **SETUP.md §1.7** の内容を貼る（スケルトンのみでOK）

### 2-2. `.gitignore` に追記

```bash
cat >> .gitignore <<'EOF'

# Claude Code
CLAUDE.local.md
~/.claude/plans/
.claude/local-*

# 機密
.env
.env.*
!.env.example
secrets/
EOF
```

---

## Phase 3: Supabase セットアップ（10分）

### 3-1. ローカル Supabase を初期化

```bash
supabase init
supabase start   # Docker が起動していること
```

### 3-2. リモートプロジェクトと紐づける

```bash
supabase link --project-ref <your-project-ref>
# project-ref は Supabase ダッシュボード URL の /project/<ここ>
```

### 3-3. 初期マイグレーションを配置して適用

```bash
# migration ファイルをコピー
cp 20260501000000_initial_schema.sql supabase/migrations/

# ローカルに適用
supabase db reset

# 型を生成
pnpm gen:types
# → src/types/database.types.ts が生成されたことを確認
```

### 3-4. Supabase Auth の設定

Supabase ダッシュボード → Authentication → Providers:
- Email サインアップを **OFF** にする（CLAUDE.md §10 参照）

root ユーザー作成:
```bash
# scripts/setup-root-user.ts を作って Service Role 経由で実行
# (仕様書 §7-1-b / CLAUDE.md §10 参照)
```

---

## Phase 3.5: v0フロントの移植（任意）

v0で作ったフロントがある場合はここで持ってくる。環境変数より先に入れておくと、Phase 4完了後すぐ動作確認できる。

### 3.5-1. ファイルを配置

v0からコピーしたコードを以下に配置:

```
src/app/          # ページ・レイアウト・ルート
src/components/   # UIコンポーネント
src/lib/          # ユーティリティ（ただし supabase/ 以外は後で整理）
```

> **注意**: v0が生成した `lib/supabase.ts` 等は、CLAUDE.md §4の `src/lib/supabase/` 構成と違う場合がある。今は一旦置くだけでいい。Claude Codeに整理させるのは Phase 6 以降。

### 3.5-2. 依存ライブラリの確認・追加

v0が使っているライブラリで `package.json` にないものを追加:

```bash
# v0のコードを眺めて import されているライブラリを確認してから
pnpm add <必要なライブラリ>
```

shadcn/ui を使っている場合:
```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add <使っているコンポーネント名>
```

### 3.5-3. 型エラーの確認

```bash
pnpm typecheck
```

エラーが出た場合:
- Supabase 型参照（`Database` 型等）のエラー → Phase 3-3 で `gen:types` が完了していれば `src/types/database.types.ts` を import するよう直す
- その他のエラー → 量が多ければ Claude Code に頼む（Phase 5以降）。今は `// @ts-ignore` で一時的に抑えてもいい

---

## Phase 4: 環境変数（5分）

`.env.local` を作成（`.gitignore` に入っていることを確認してから）:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>  # supabase start で表示される
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>  # 同上

# Vertex AI TTS
GEMINI_TTS_MODEL=gemini-2.5-flash-tts
GOOGLE_APPLICATION_CREDENTIALS_JSON=<サービスアカウント鍵JSON を1行にしたもの>

# MQTT
NEXT_PUBLIC_MQTT_URL=<HiveMQ Cloud の URL>
NEXT_PUBLIC_MQTT_USER=<username>
NEXT_PUBLIC_MQTT_PASS=<password>
```

---

## Phase 5: シェルエイリアスと動作確認（10分）

> 詳細手順: **SETUP.md §2, §3**

```bash
# Plan Mode 既定エイリアス
echo "alias cc='claude --permission-mode=plan'" >> ~/.zshrc  # bash なら ~/.bashrc
source ~/.zshrc
```

### 動作確認チェックリスト（SETUP.md §3 に詳細あり）

```bash
cc   # Claude Code を Plan Mode で起動
```

Claude Code が起動したら以下を順に確認:

- [ ] `CLAUDE.md を要約して` → Stack / Don'ts / Workflow が返ってくる
- [ ] Plan Mode の footer に `⏸ plan mode on` が出ている
- [ ] `.env の中身を見せて` → Permission denied が返る（deny ルール確認）
- [ ] `test.ts` に型エラーのあるコードを書かせる → Hook が走って TypeScript エラーが返ってくる
- [ ] 確認後 `rm test.ts`

---

## Phase 6: 最初の実装フェーズへ（開発スタート）

全チェックが通ったら開発開始。最初のフェーズは SETUP.md §4 を参照:

```
cc
```

最初のプロンプト例（SETUP.md §4 から）:

```
これから音声コンテンツプロトタイプを作る。最初のフェーズとして、
Supabase のスキーマ設計と RLS ポリシーをやりたい。
（以下略、SETUP.md §4 参照）
```

**進め方の基本リズム（ベストプラクティス §5.3）**:
1. フェーズ入口で `/plan`
2. Plan に納得 → Auto-accept で実装
3. 各ステップ後に `git diff` を読む
4. フェーズ終了 → commit → `/clear` → 次フェーズの `/plan`

---

## いつでも見返す参考ドキュメント

| 何を知りたいとき | 見るファイル |
|---|---|
| 機能要件・設計判断の根拠 | `functional_spec_v2.md` |
| 実装規約・Claude Code へのガードレール | `CLAUDE.md` |
| セットアップ手順の詳細 | `SETUP.md` |
| Claude Code の運用ベストプラクティス | `claude_code_best_practices_v2.md` |
| DB スキーマの定義 | `20260501000000_initial_schema.sql` |
