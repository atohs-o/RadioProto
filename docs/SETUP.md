# Claude Code プロジェクト セットアップ手順 (Golden Week 版)

ベストプラクティス v2 を新規プロジェクトに最初から仕込むための実作業ガイド。
所要時間: **約 30 分**。Next.js / Supabase 等の初期化は含まない (それは別作業)。

---

## Pre-flight チェック (5分)

ターミナルで:

```bash
# Claude Code が最新か確認 (v2.1.118 以降推奨)
claude --version

# 古い場合はアップデート(Claude Code 自体のインストールは npm グローバル、プロジェクト内は pnpm)
npm update -g @anthropic-ai/claude-code

# プロジェクトのルートに移動
cd ~/path/to/autodj_radio  # ← 自分のパスに置き換え

# git が初期化されていることを確認
git status
```

`claude --version` が `2.1.118` 未満なら必ずアップデート (`/usage` が古い名前のままになる)。

**プラン確認**: Pro/Max/Team どれを使うか今のうちに決める。Golden Week 集中投下なら **Max 5x ($100/月)** が経済的に正解。API 直接利用は長セッションで一番損する。

---

## Step 1: ディレクトリ構造と中核ファイル (15分)

### 1.1 ディレクトリを切る

```bash
mkdir -p .claude/rules .claude/skills .claude/agents docs
touch .claude/settings.json
touch CLAUDE.md CLAUDE.local.md
touch docs/data-governance.md docs/supabase-rls-policies.md
```

`.claude/skills/` と `.claude/agents/` は当面空でいい。今は箱だけ作る。

### 1.2 `.gitignore` に追記

```bash
cat >> .gitignore <<'EOF'

# Claude Code (個人設定とプラン履歴)
CLAUDE.local.md
~/.claude/plans/
.claude/local-*

# 機密ファイル (念のため)
.env
.env.*
!.env.example
secrets/
EOF
```

### 1.3 `CLAUDE.md` を配置する

`CLAUDE.md` の完成版は `docs/functional_spec_v2.md` と同じディレクトリ構成で管理されている。**このセットアップ手順内のテンプレは使わない**。

プロジェクトルートに `CLAUDE.md` ファイルをコピー or 配置して、行数を確認:

```bash
wc -l CLAUDE.md  # 200行以下であることを確認
```

200行を超えていたら、Auto Memory に任せられる細かい好みを削除して絞る。

### 1.4 `CLAUDE.local.md` (Gitに入れない個人用)

```markdown
# Local environment notes (personal, not committed)

- Local dev server: http://localhost:3000
- Local Supabase: http://localhost:54321
- Local Postgres: postgresql://postgres:postgres@localhost:54322/postgres
- 個人の Vercel project: <自分の Vercel ダッシュボード URL>
- Anthropic API account: Max 5x

## Personal preferences
- 早期 return を強く好む
- コメントは過剰に書かない (関数名で表現できるならそれで)
- import 順は: external → internal → relative
```

### 1.5 `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm run *)",
      "Bash(pnpm *)",
      "Bash(npx supabase db diff)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Read",
      "Glob",
      "Grep"
    ],
    "ask": [
      "Bash(git push:*)",
      "Bash(npx supabase migration up)",
      "Bash(npx vercel *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Bash(cat .env*)",
      "Bash(rm -rf *)",
      "Bash(git push --force *)",
      "Bash(curl *anthropic.com*)",
      "Bash(npm run *)",
      "Bash(npm install *)",
      "Bash(yarn *)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "test -f $CLAUDE_FILE_PATHS && (npx prettier --write $CLAUDE_FILE_PATHS 2>/dev/null; npx tsc --noEmit 2>&1 | head -30) || true"
          }
        ]
      }
    ]
  }
}
```

**注意点**:
- `Bash(cat .env*)` を deny に入れているのは、`Read(./.env)` deny だけだと Bash 経由で迂回できるから。元ドキュメントの落とし穴指摘そのもの。
- `Bash(npm run *)` / `Bash(yarn *)` を deny に入れているのは、プロジェクト内パッケージマネージャーを pnpm に統一するため。Claude Code がうっかり npm を使うのを防ぐ。
- Hook の最後の `|| true` は、最初は失敗しても止めない設計。慣れたら外して strict にする。
- `npx tsc --noEmit | head -30` で出力を切ってトークン消費を抑える。

### 1.6 `docs/data-governance.md` の最低限版

```markdown
# Data governance notes

## DPA 状況
- Anthropic API (Claude): DPA 締結済み、Zero retention 対応
- Gemini API (有料 tier): DPA 締結済み
- Vercel Pro: DPA 締結済み
- Supabase: DPA 締結済み

## ログ・データの取り扱い
- 車内アンケート回答は PII を含む可能性。Gemini に渡す前に最低限の匿名化を検討
- Claude Code の transcript はローカル ~/.claude/ にのみ保存 (送信されるのは API 経由のみ)
- Vercel のアクセスログは個人特定可能性あり

## 禁止事項
- 本番 PII を開発環境にコピーしない
- API key をリポジトリにコミットしない (gitleaks 等で事前チェック)
```

### 1.7 `docs/supabase-rls-policies.md` (空でも作っておく)

スキーマ設計時に Claude が参照できるよう、最低限のスケルトンだけ:

```markdown
# Supabase RLS policies

## 原則
- 全テーブルで RLS 有効
- 新テーブル作成時は同 migration で policy を最低1つ作成
- service_role を使う Server Action は `lib/supabase/admin.ts` 経由のみ

## Policy 一覧 (随時更新)
(まだなし)
```

---

## Step 2: シェル環境 (3分)

```bash
# Plan Mode 既定の起動エイリアス
echo "alias cc='claude --permission-mode=plan'" >> ~/.zshrc  # bash なら ~/.bashrc
source ~/.zshrc

# 確認
which cc
```

これで `cc` と打てば常に Plan Mode 起動。普段使いはこっち。Auto-accept で流したいときだけ素の `claude` を使う。

---

## Step 3: 動作確認 (5分)

### 3.1 起動して CLAUDE.md がロードされるか確認

```bash
cc
```

Claude Code が起動したら最初のプロンプトで:

```
このプロジェクトの CLAUDE.md を要約して。何が書いてあって、君は何を守るべきか教えて。
```

返答に Stack, Don'ts, Workflow が含まれていれば OK。「ファイルが見つからない」と言われたら Step 1 のパスを確認。

### 3.2 Plan Mode の動作確認

すでに `cc` で起動していれば Plan Mode のはず。footer に `⏸ plan mode on` が出ていれば OK。

```
README.md を作る計画を立てて (実装はまだしないで)
```

実装に走らずプランだけ返してくれば OK。

### 3.3 Deny ルール動作確認

Plan Mode を一旦 exit (Shift+Tab で Default に戻す) してから:

```
.env ファイルの中身を見せて
```

`Permission denied` または「読めません」が返ってくれば OK。読めてしまったら Step 1.5 の deny ルールを見直し。

### 3.4 Hook 動作確認

軽くファイル編集させてみる:

```
test.ts という空のファイルを作って、そこに `const x: number = "hello";` と書いて
```

書き込み後、Hook が走って TypeScript エラーが Claude に返ってくるはず。Claude が「型エラーがありました、修正しますか?」と返してくれば Hook 動作 OK。

確認後 `rm test.ts`。

---

## Step 4: 最初のフェーズに入る (5分)

ここから本番。最初のフェーズを何にするかは事前に決めておく。例えば:

**フェーズ A 候補**: 「Supabase スキーマと RLS ポリシー設計」

```bash
cc
```

最初のプロンプト:
```
これから音声コンテンツプロトタイプを作る。最初のフェーズとして、
Supabase のスキーマ設計と RLS ポリシーをやりたい。

要件:
- bus_routes (バス路線)
- bus_stops (停留所、緯度経度持ち)
- audio_contents (オーディオコンテンツ、停留所と関連)
- play_logs (再生ログ、PII 含む可能性あり)

これらのテーブルと RLS ポリシーを Plan Mode で計画して。
実装はまだしないで、SPEC.md にまとめてほしい。
```

Plan が返ってきたら:
- 納得できない部分は対話で修正 (`Ctrl+G` でプラン直接編集も可)
- 納得したら「`docs/supabase-schema-spec.md` に書き出して、その後 `/clear` してほしい」と頼む
- `/clear` 後、新セッションで「`docs/supabase-schema-spec.md` を読んで実装して」と言う

---

## 1日目終了時のチェックリスト

夜寝る前にこれだけ確認:

- [ ] `CLAUDE.md` が 200 行以下
- [ ] `CLAUDE.local.md` が `.gitignore` に入っている
- [ ] `.claude/settings.json` の deny ルールが `.env` を確実に守っている
- [ ] PostToolUse Hook が編集後に走っている
- [ ] `cc` エイリアスで Plan Mode 起動できる
- [ ] `/usage` で今日のコストを確認した
- [ ] フェーズ A の SPEC が `docs/` に書き出されている (もしくは進行中)
- [ ] 1セッションが1タスクに収まっている (混ぜない)

このうち1つでも欠けてたら、明日朝の最初の30分で埋めるのが投資対効果的に賢い。

---

## トラブルシュート

### Hook が走らない
- `.claude/settings.json` の JSON が valid か確認 (`cat .claude/settings.json | jq .`)
- `claude` を再起動 (settings.json は起動時読み込み)
- `matcher` の正規表現が合っているか

### Plan Mode に入れない (Windows)
- Shift+Tab が効かない既知バグ → `/plan` スラッシュコマンド or `claude --permission-mode=plan` で起動

### `/usage` が見つからない
- v2.1.118 未満。`npm update -g @anthropic-ai/claude-code`

### CLAUDE.md が読まれていない感じがする
- ファイル名が大文字 `CLAUDE.md` (小文字 `claude.md` だと無視される OS あり)
- プロジェクトルートに置いているか
- 起動時に「Claude.md を要約して」で聞き直す

### トークンが想定より早く焦げる
- `/context` で何が占めているか確認 (たいてい MCP or 大ファイル読込)
- `/usage` でモデル別内訳を見る (Opus メインのつもりが他モデルになっていないか)
- 1セッション1タスク守れているか自己点検

---

## 参考: 1週間後の見直しポイント

Day 7 ぐらいで以下を点検:

- CLAUDE.md に「もう要らない」記述はないか? (Claude が指示なしでも守れていることは削除する)
- Auto Memory (`/memory`) に何が貯まっているか確認
- Hook が遅延を生んでいないか (200ms 以内が目安)
- 「Plan Mode を飛ばしたくなった瞬間」を思い出して、どこに無理があったか

ここまでがセットアップの全部。後はベストプラクティス v2 ドキュメントの 3節ロードマップに沿って育てていく。
