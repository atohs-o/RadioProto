# Claude Code 業務活用ベストプラクティス v2 (2026年5月時点・批判的再整理版)

> 元ドキュメント (Sonnet 4.6, 2026年4月) を基に、Opus 4.7 (2026年5月) からの観点で批判的に再構成。
> 重点：①トークン効率、②手戻りの少ない進め方、③stable な慣行のみ、④トレーサビリティと vibe coding の操作感の両立、⑤段階的なステップアップ。

---

## 0. まず結論：3つの核心原則

長い目次より、これだけ覚えておけば 80% カバーできる、という3つです。

1. **「自己検証手段を Claude に渡す」が最大のレバー**。テスト・型チェック・スクリーンショットを見せる。これは元ドキュメントも言っていますが、本当に最重要です。検証なき出力は信用しない。

2. **コンテキストは最も希少な資源**。CLAUDE.md は 200行以下、`/compact` は 60% で先手、必要のないものは Subagent に隔離。MCP サーバーの常時接続はコスト的に高い。

3. **人間が最終責任を持つ設計を崩さない**。Plan Mode で合意 → 実装。Auto-accept は同じ作業を100回やった慣れたタスクだけ。「20分で20,000行を生成し、2年かけてデバッグ」を避けるための儀礼的なゲートとして Plan Mode を使う。

それ以外は「中庸の調整」で、状況に応じて重心を探す類のものです。

### ベストプラクティスは2層ある

このドキュメント全体に通底する区別として、ベストプラクティスは2層に分かれます。

| 層 | 何か | 例 | 移植性 |
|---|---|---|---|
| **User 側** | 人間が身につける運用習慣・判断・タイミング | Plan Mode をいつ使うか、`/compact` をいつ打つか、diff を読むリズム、課題の分離 | 別ツールに移っても残る |
| **Claude Code 側** | ツールに仕込む設定・ファイル・自動化 | CLAUDE.md, settings.json, hooks, subagents, skills | この道具に固有 |

迷ったら **User 側を先に固める** のが原則。User 側の規律がない状態で Claude Code 側の高度な設定 (Subagent や Hook の凝った構成) を増やしても、消費トークンと運用コストが上がるだけで成果は上がりません。逆に User 側の規律ができていれば、Claude Code 側は最小構成 (CLAUDE.md + permissions + 1つの Hook) で十分機能します。

このドキュメントの最後 (10節) に、両層を並べたチートシートを置きます。

---

## 1. 元ドキュメントから何が変わったか (April → May 2026)

元ドキュメントは v2.1.x 中盤頃のスナップショット。この2週間ほどで、知っておくべき更新が複数あります。

### 1.1 Auto Memory (v2.1.59+) ★最重要の追加

CLAUDE.md とは別に、**Claude が自分で作って育てる記憶ファイル群**が追加されました。
- 場所: `~/.claude/projects/<project-hash>/memory/`
- 仕組み: Claude が「これは将来も使えそう」と判断した build コマンド・デバッグ知見・コード規約等を、ユーザーが書かなくても自動で蓄積。
- インデックス: `MEMORY.md` が 200 行以内のインデックスとして毎セッション読み込まれる。
- メンテ: `/memory` コマンドで閲覧・編集・削除。Auto Dream が裏で陳腐化エントリを掃除。

**意味すること**: CLAUDE.md に「俺はこういうコード書き方好き」みたいな細かい好みを書く必要はもう無い。Auto Memory に任せて、CLAUDE.md は **新人エンジニアが知らないと困る客観的な事実** (build コマンド、ディレクトリ規約、外部サービス前提) のみに絞れる。

```
責務分担：
CLAUDE.md  = ユーザーが明示的に書く、客観的でほぼ変わらない事実
MEMORY.md  = Claude が自動で作る、学習結果のインデックス
.claude/rules/  = 大型のルールセットを path-scoped に分割した置き場
.claude/skills/ = オンデマンドで呼ぶ playbook (使う時だけロード)
```

### 1.2 `/plan` スラッシュコマンド (v2.1.0+)

Shift+Tab を2回押す方式 (Mac/Linuxでは依然有効) に加え、`/plan` で Plan Mode に入れるようになりました。Windows で Shift+Tab が効かない不具合があった時期もあったので、`/plan` のほうが安定。

### 1.3 `/usage` (v2.1.118 で `/cost` + `/stats` を統合)

セッションのトークン消費・コストを見る公式コマンド。元ドキュメントの `/cost` は `/usage` に置き換わっていると思った方がよい。

### 1.4 `/recap` 機能

数時間後にセッションに戻ってきた時、「これまで何やってたか」を要約してくれる機能。長時間セッションが前提化したことの傍証。

### 1.5 Auto Mode (research preview)

`Default → Auto-accept → Plan` の3モードに加えて、**入力プロンプトインジェクション検査 + 出力 transcript 分類** で安全な操作だけ自動承認する第4モードが research preview。「ユーザーは結局 93% の権限プロンプトを承認している」という Anthropic の知見が背景。

**翔太さんへの提案**: research preview は採用しないでください。元ドキュメントが警告している `--dangerously-skip-permissions` の悪夢を 30% マシな安全性で再生する可能性がある。stable になってから検討。

### 1.6 Plugins / Marketplaces

Skills, hooks, subagents, MCP servers, LSP servers をパッケージ化して `/plugin` で導入できる仕組み。ただし、サードパーティの Plugin を入れるのはサプライチェーン上の信頼を1つ増やすので、慎重に。社内利用ならまず公式・Anthropic 製のみに限定。

### 1.7 元ドキュメントの古い表現

- 「Sonnet をデフォルトに、Opus は複雑な設計のみ」→ 5月現在 **Opus 4.7 が medium-effort で速度・コストのスイートスポット**。Max/Team は medium 既定。Sonnet 4.6 は Subagent や Skill 系の軽量タスクに回す方がコスト最適。
- Opus 4.7 のネイティブコンテキストは 1M トークン (200K のときの古い計算で `/context` が出ているバグもあったが修正済)。
- Sub-agent の Built-in は 6種類に増えた（Explore, Plan, General-purpose, Guide, Verification, Statusline）。元ドキュメントの「3種類」は古い。

---

## 2. 元ドキュメント10論点の批判的レビュー

各論点について、`✅ 維持`、`⚠️ 修正`、`❌ 不採用` で分類します。

### 論点1：ツールセット使い分け → ⚠️ 概ね正しいが、初心者向けの順序が違う

**修正点**: 「CLAUDE.md + Skills で 80% → Hooks → Subagent → MCP」の導入順は理屈としては正しいが、vibe coding 初級者がいきなり Skills を作るのは、過剰な投資です。**初級者は CLAUDE.md だけで始め、Hooks は formatter/linter だけ、Subagent と MCP は最初の月は触らない** でいい。Skills は「同じ playbook を何回もコピペしてるな」と気づいた時点で初めて作る。

**重要な原則の追加**: **CLAUDE.md は確率的、Hooks は決定論的**。「フォーマット・リント・セキュリティチェックなど、毎回必ず起きてほしいこと」は CLAUDE.md ではなく Hook に書く。CLAUDE.md は約80%しか守られない。

### 論点2：実装品質はTDD × Hooks → ✅ ほぼ維持。ただし

**注意**: 元ドキュメントの「Writer/Reviewer パターン (別の Claude にレビューさせる)」は強力ですが、トークンコスト2倍。`vibe coding` の初期段階では PR レベルでまとめて1回やれば十分で、毎コミットでは過剰。

**追加**: **`claude ultrareview` (Team/Enterprise の cloud-based multi-agent code review)** は5-10分で約 $5-20/run のサービス。Pro/Max は3回まで無料。**個人プロトタイプには不要**。本番投入直前の重要 PR のみ。

### 論点3：トークン管理 (`/compact`, `/clear`) → ✅ 維持

**追加**: **Subagent への委任が最大のトークン節約レバー**になることが、元ドキュメントよりも強調されるべき。`/compact` は損失圧縮、Subagent は完全分離。長時間セッションでは「Subagent に Explore させて要約だけ受け取る」のが品質・コストの両面で勝つ。

ただし**Subagent は4-7倍のトークン**を消費する点も忘れずに。「main セッションが汚れるリスク」と「Subagent コスト」を天秤にかける。読み取り中心 (Explore) は Haiku で安く、書き込み込み (general-purpose) は Sonnet で。

**Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) は約15倍コスト**で、experimental。**翔太さんは絶対使わなくていい**。

### 論点4：Vibe coding の信頼性 → ⚠️ 文脈依存

元ドキュメントは「Vibe Codingアプリの大半が securityheaders.com で F 評価」「24.7% に脆弱性」等の数字で重く警告していますが、これは**プロダクション運用の話**。Golden Week のプロトタイプで、コミュニティバスのアンケートデータを扱う段階では、過剰防衛してフリクションを上げると探索の意味が薄れます。

**段階別の現実的な防衛線**:

| 段階 | 必須 | あれば良い | 不要 |
|---|---|---|---|
| プロトタイプ (社内・少人数) | Hooks (lint/format/typecheck), `.env` の deny, 認証ロジックは Plan Mode 必須 | `/security-review` を週1で | Multi-agent review, 監査ログ |
| 本番候補 (実証実験) | 上記 + `/security-review` 必須, RLS 検証, 依存パッケージスキャン | claude ultrareview | - |
| 本番運用 | 全部 | - | - |

### 論点5：CLAUDE.md は簡潔・構造的・段階的 → ⚠️ 1.1で説明した Auto Memory の存在で書き分けが変わる

**新しい責務分担**:
- CLAUDE.md (200行以下、Git コミット): build コマンド、テスト実行、ディレクトリ前提、必ず守るべきハードルール (例: `JWT は httpOnly cookie のみ、localStorage 禁止`)
- CLAUDE.local.md (.gitignore): 個人の開発環境固有 (ローカルポート、シークレットファイル位置)
- MEMORY.md (Claude が自動で書く): 学習結果。手動で編集はするが書き起こしはしない。
- `.claude/rules/*.md`: パスや種別でスコープしたルール (例: `frontend.md`, `database.md`)
- `.claude/skills/*/SKILL.md`: 再利用可能な playbook

**翔太さんのスタック向け CLAUDE.md テンプレ** (4節で詳しく)。

### 論点6：Plan Mode と TodoWrite → ✅ 強く維持。ただし運用上の追加

**Plan Mode の起動方法**:
- Shift+Tab × 2 (Mac/Linux で安定)
- `/plan` (v2.1.0+, より確実)
- `claude --permission-mode=plan` (起動時から)

**Plan Mode のコスト感**: 元ドキュメントが触れていないが、Plan Mode は**読み取り専用なのでファイル書き込みなしで往復できる = 安い**。Boris Cherny (Claude Code 作者) 自身も「ほとんどのセッションを Plan Mode で始める」とのこと。**怖いから使うのではなく、安いから使う**、という発想転換が大事。

**Plan の保存**: 承認した Plan は `~/.claude/plans/` に markdown として保存され、`/clear` や圧縮を生き延びる。後で diff を取れる。これが**トレーサビリティの肝**。

### 論点7：Claude Code の苦手領域 → ✅ 維持。リスト追加

**追加で苦手**:
- マイグレーション設計 (DB スキーマ変更): "成功した" と報告するが冪等性や rollback を考えていない
- 並列処理・ロック設計: silently 間違える典型
- 暗号設計: ライブラリ選定は OK だが、パラメータ選定は危険
- 翔太さんのケースで言うと: **Supabase RLS ポリシーの設計**は Claude にいきなり任せず、まず仕様を人間で固めてから実装させる方が安全

### 論点8：「AI に任せすぎて自分で書けなくなる」→ ✅ 維持

**翔太さんへの個別注釈**: 翔太さんは Python/C# は手で書けるので、Next.js + TypeScript + React の側で「概念は分かるが手は遅い」状態のはず。この場合、**「Claude に書かせて自分で読んで書き直す」**を1日に1回はやる。読み流して PR するのが一番危ない。

### 論点9：組織展開と権限 → ⚠️ 翔太さんの段階では先回りしすぎ

15名の JV で、自分一人が試している段階で `managed-settings.json` や OpenTelemetry を設計するのは早い。**まずは個人レベルの settings.json と permission allowlist を整備し、3人ぐらい使う段階で `.claude/settings.json` をチーム共有する**、ぐらいの順序でいい。

ただし、**「Read deny ルールは Bash 経由の `cat .env` を防げない」**という指摘は重要。これは個人レベルでも今日からやる価値がある防衛。

### 論点10：効果測定 → ⚠️ 個人段階では3軸測定は重い

METR の「24% 速くなったと予測 → 実は 19% 遅かった」は、自己申告バイアスの強烈な事例として記憶しておく価値はあります。が、**個人プロトタイプ段階で `claude_code.code_edit_tool.decision` のメトリクスを追うのは過剰**。

**個人段階で見るべき1つの指標**: 「先週末の commit を、今 Claude なしで書き直せるか?」これが Yes ならOK、No なら理解が浅い。

---

## 3. ステップアップ・ロードマップ (vibe coding 初級 → 中級)

翔太さんが Python/C# は書けて、Next.js / TypeScript は書ける言語というよりは触ったことがある言語、という前提で、Golden Week 〜 数ヶ月のスパンで段階的に。

### Day 1-3: 最低限の安全装置 + トークン衛生

```bash
# Plan Mode を既定にして開始するエイリアス
alias cc='claude --permission-mode=plan'
```

`./CLAUDE.md` を作る (4節のテンプレを参照)。これだけ。Subagent も Skills も Hooks もまだ作らない。

**作業ルーチン**:
1. `/plan` で何をするか合意
2. 承認 → 実装
3. 実装後、`git diff` を自分で読む
4. テストを自分で書くか走らせる
5. セッション終わりに `/usage` でその日のコストを確認

**トークン衛生 (Day 1 から定着させる)**:

トークン焦げの主因は「長セッション + `/clear` 忘れ + auto-compact が 80-90% で発動 → 要約品質劣化 → やり直し」のループ。これを Day 1 から抑える。

- **1セッション = 1タスク** が原則。タスクを切り替える時は `/clear`。前のタスクの文脈は混ぜない。
- **`/context`** で現在の使用率を確認するクセ。重いファイルや PDF を読ませた直後、Subagent から戻ってきた直後など、「何か起きた後」に見る。毎ターンは見なくていい。
- **`/compact` は 60% で先手**。auto-compact (80-90%) に任せると要約品質が落ちて、結局やり直しになる。残したい情報を引数で指定: `/compact Focus on the API changes and test results`
- **同じ問題で 2 回失敗 = `/clear`** して仕切り直し。文脈が「負の価値」になっている合図。
- **大きな JSON / log / PDF / migration 出力は main に読ませない**。Subagent に渡して要約だけ受け取る (これは Day 1 でも、`Use a subagent to read X and summarize` と自然言語で頼むだけで OK)。
- **CLAUDE.md は 200 行以下を死守**。毎セッション全量ロードされるので、ここの肥大化が真綿で首。

**Day 1 で覚えるアンチパターン**:
- `/compact` を auto に任せる (80% 超で要約品質が落ちる)
- `/compact` 後の Claude の主張を検証なしで信じる (圧縮直後はハルシネーションしやすい。「100% 成功した」と言われても疑う)
- "ちょっとプロジェクト全体見て" で全ファイル読み込ませる (具体的なパス・パターンを指定する)
- セッションを何時間も開いたまま、別の話題を混ぜる

### Day 4-7: 自動チェックの仕込み

`./.claude/settings.json` に **PostToolUse Hook を1つだけ** 入れる：
ファイル編集後に `npx tsc --noEmit` と Prettier を走らせる。Lint エラーが Claude にフィードバックされ、自分で直してくれる。

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Bash(curl *anthropic*)",
      "Bash(rm -rf *)",
      "Bash(git push --force *)"
    ],
    "ask": [
      "Bash(git push:*)",
      "Bash(npx supabase *)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "test -f $CLAUDE_FILE_PATHS && (npx prettier --write $CLAUDE_FILE_PATHS && npx tsc --noEmit) || true"
          }
        ]
      }
    ]
  }
}
```

(コマンド部分はあなたのプロジェクトに合わせて調整。最初は緩めに `|| true` で fail させない方が学習段階としてはストレスが少ない。)

### Week 2-3: 仕様駆動と運用の安定化

- 大きな機能は「`/plan` → SPEC.md に書き出す → `/clear` → 新セッションで実装」のパターンに移行
- Day 1 で身につけた `/compact` `/clear` `/context` を**反射神経レベル**にする
- `/usage` で1日のコスト感が体に入っているか? 想定との乖離があれば原因を探す (たいていは Subagent or 長セッション)

### Month 1: 1つだけ Skill を作る

「フリマで見つけた古着の写真からタグデータを抽出する」みたいな、自分が3回以上やる playbook を1つだけ Skill 化する。複数作らない、最初は1つで。

### Month 2+: Subagent を1つだけ導入

「Supabase スキーマ変更時のレビューを専門にする Subagent」みたいに、文脈の汚染が惜しいタスクに限定して導入。複数同時並行はしない。

### 触らなくていいもの (当面)

- Agent Teams (15倍コスト)
- Auto Mode (research preview)
- 自前の MCP サーバー設計
- OpenTelemetry / Compliance API
- claude ultrareview
- Plugin の他者作

---

## 4. 翔太さんのスタック向け CLAUDE.md テンプレ

Next.js (App Router) + TypeScript + Supabase + Gemini API + Leaflet を想定。プロジェクト名は仮で `autodj_radio` とします。

```markdown
# autodj_radio

モビリティサービス向け音声コンテンツのプロトタイプ。
コミュニティバス車内向けの位置連動オーディオ配信。

## Stack
- Next.js 15 (App Router, RSC), TypeScript strict
- Supabase (Postgres + Auth + Storage), RLS 必須
- Gemini API (有料 tier, DPA 締結済み)
- Leaflet for map UI
- Deploy: Vercel Pro

## Common commands
```
pnpm dev              # local
pnpm build && pnpm start  # prod build sanity
pnpm lint && pnpm typecheck  # before any commit
npx supabase db diff     # before applying migrations
npx supabase migration up
```

## Code style
- TypeScript: strict mode, no `any`
- React: Server Components by default, "use client" は最小限
- Server Actions: 入出力を zod で検証
- 早期 return を nested if より優先
- 命名: camelCase (vars/funcs), PascalCase (components/types)

## Architecture rules
- DB アクセスは `lib/supabase/` 経由のみ。コンポーネントから直接 createClient しない
- すべての Supabase クエリはテーブルに RLS が有効であることを前提とする
- API Route は `/app/api/` のみ。Server Action で済むなら Action を優先
- 環境変数: `process.env.X` の参照は `lib/env.ts` 経由で型安全に

## Don'ts (YOU MUST NOT)
- `.env` `.env.*` `secrets/**` を読まない
- localStorage / sessionStorage を artifact 系コードで使わない (本来の Web では OK だが、ガイダンスとして)
- 既存 migration ファイルを編集しない (新しい migration を作る)
- Gemini API key, Supabase service-role key をクライアントバンドルに含めない
- production DB に直接接続しない (常に Supabase migration 経由)

## Workflow
- 変更が3ファイル以上、もしくは認証/DBスキーマ/決済に触れる場合は **必ず Plan Mode**
- 機能追加: SPEC.md にスペックを書き出してから実装
- migration: ローカルで `supabase db diff` を確認 → 私 (人間) が apply

## Verification
- 変更後は `pnpm lint && pnpm typecheck` を必ず実行
- UI 変更はスクリーンショットで確認 (Playwright か手動)

## References
@docs/data-governance.md
@docs/supabase-rls-policies.md
```

**ポイント**:
- 200行いってない (今 ~60行)
- IMPORTANT/YOU MUST のような強調は最小限に、本当に守らせたいルールだけ
- コードスタイルは Linter/Prettier に任せ、ここには設計上のルールだけ
- `Don'ts` を明示することで Plan Mode の判断材料になる

### `.claude/rules/supabase.md` (path-scoped にしてもよい)

```markdown
# Supabase rules

## RLS は必ず有効
- `enable_row_level_security = true` を全テーブルに
- 新テーブル作成時は同じ migration で policy を最低1つ作る
- service_role を使う Server Action は `lib/supabase/admin.ts` 経由のみ

## Migration
- `npx supabase migration new <name>` で作る
- 既存ファイルは編集しない
- `supabase db reset` はローカルのみ (本番では絶対使わない)
```

---

## 5. トレーサビリティと vibe coding の操作感の両立

翔太さんからの問いの核心。これは技術的な答えと哲学的な答えがあります。

### 技術的な答え：3層の制御点

| 層 | 制御の粒度 | 例 |
|---|---|---|
| Plan | アーキテクチャ単位の合意 | Plan Mode で承認 → 実装 |
| Diff | コミット単位の確認 | `git diff` を毎ターン読む |
| Hook | 操作単位の自動防衛 | Edit 後に lint, deny rule で `.env` 保護 |

vibe coding の「速さ・流れ」が壊れるのは Diff 層で**つど止まって読む**時。これを Hook 層に下ろせる部分は下ろす (lint は Hook、ロジックは目視)。Plan 層を**入口で太くする**ことで、Diff 層の負担を減らせる。

つまり: **入口 (Plan) と出口 (Hook) を太くすると、中間 (Diff) は流せる**。これが vibe coding と traceability の両立解。

### 哲学的な答え：「課題の分離」を Claude にも適用する

翔太さんの行動指針にある「課題の分離」は、人間関係だけでなく **AI との分業** にも適用できる。「Claude が何を決め、私が何を決めるか」を明示的に区切る。

- Claude が決める (任せる): 命名、シンタックス、ライブラリの呼び方、定型のテストコード、リファクタリングの細部
- 人間が決める (Plan Mode で議論する): アーキテクチャ、データモデル、認証フロー、UX の根本設計、外部 API との契約

このリストは契約書ではないので動かしていい。ただ、**動かす時は意識的に動かす**。「気がついたら Claude が認証フローまで設計していた」のような滑り (旧 OS の自動再起動と似ています) を避ける。

これを CLAUDE.md に書いておくのも一手です:
```
## Decisions reserved for human
- Auth flow design
- Database schema
- Public API contracts
- Cost-affecting trade-offs (caching, rate limiting strategy)
```

### 実践：フェーズ境界で Plan Mode に戻る

「マイクロステップ毎に Plan Mode に戻るべきか?」という問いへの答え。**毎ステップは過剰、一度の計画で全部流すのは手戻りの温床**。中間解として **フェーズ境界で戻る** 運用を推奨します。

**フェーズの粒度**: 1 フェーズ = 論理的にひとまとまりの作業 = 30〜60分程度。例:
- フェーズ A: Supabase スキーマ + RLS ポリシー
- フェーズ B: Server Action (CRUD)
- フェーズ C: Leaflet マップの基本表示
- フェーズ D: 位置連動オーディオ再生

**フェーズ内のリズム** (Plan Mode に戻らない):
1. フェーズ入口で `/plan` (例: 「bus_routes テーブルを RLS 込みで作る」)
2. 計画に納得したら exit して Auto-accept
3. TodoWrite が 3〜6 ステップに分割してくれる
4. 各ステップ完了で `git diff` を読む (これは省略しない)
5. 想定通りなら次へ。想定外なら `/plan` に戻る

**フェーズ境界の小さな儀式** (必ずやる):
- 一旦 commit
- `/clear` か `/compact 60%`
- 次のフェーズの `/plan`

**フェーズ内であっても Plan Mode に戻るトリガー**:
- 不可逆な操作の直前 (migration apply, `git push`, 外部 API 書き込み, deploy)
- 層を跨ぐとき (DB → API → UI のように考える対象が変わる)
- 「あ、思ってたのと違う」と感じた瞬間 (当初計画が古くなった合図)
- 同じ箇所で 2 回失敗 (計画自体が間違っている可能性)

**運用のコツ**: Boris Cherny (Claude Code 作者) の運用も「Plan Mode で議論 → Auto-accept で流す」だが、これは1フェーズ内の話。フェーズ境界の 30 秒の儀式 (`/clear` して `/plan`) を省略する誘惑が、3 時間後の手戻りの主因。**入口 (Plan) と出口 (commit + diff) を太くして、中間は流す** が両立解。

---

## 6. 翔太さんが意識すべきトークン経済の数字感

| 操作 | コスト感 | 翔太さんの判断基準 |
|---|---|---|
| メイン会話で1ターン | 1x | ベース |
| `/compact` 1回 | 〜0.5x (一時的) | 60% で先手 |
| `/clear` | 0 (履歴破棄) | 同じ問題で 2 回失敗したら |
| Subagent (Explore on Haiku) | ~0.3-0.5x | コードベース探索の常用に |
| Subagent (general-purpose on Sonnet) | 4-7x | 文脈隔離の価値があるとき |
| Plan Mode | 1-1.5x (読み取りのみで安い) | 不確実なタスクは常に |
| Multi-agent review | 7x+ | プロト段階では使わない |
| Agent Teams | 15x+ | 使わない (当面) |

**Max 5x ($100/月) や Max 20x ($200/月) のサブスク** は、API 直接利用より15-30倍安い。プロトタイプを Golden Week に集中して進める段階では、**Max 5x で1ヶ月試す → 足りなければ20xに上げる** が経済的に正解。Pro Plan のままで API 課金に流すのは長時間セッションで一番損するパターン。

---

## 7. アンチパターンと「やらない」リスト

元ドキュメントから引き継ぎ + 私が追加。

### やらない

- ✗ `--dangerously-skip-permissions` を通常環境で使う
- ✗ 全 MCP サーバーを常時有効にする
- ✗ 並列で5つ以上の Subagent を起動する
- ✗ Stop hook で `exit 2` を返す (無限ループ)
- ✗ "既存コードに合うテスト" を書かせる (振る舞い駆動で書かせる)
- ✗ Claude の "実装は100%成功した" 報告を検証なしで信じる
- ✗ コード行数 = 生産性で評価する
- ✗ Plan Mode 後の compaction 後に、検証なしで実装を続ける
- ✗ `_design.md`, `SPEC.md` 等を作って読まずに放置する (Claude も読まなくなる)
- ✗ Agent Teams を Golden Week で試す (1日でクレジット燃焼の可能性)

### 翔太さん固有の落とし穴

- ✗ **「内省のプロジェクト化」と同じパターン**: ベストプラクティスを集めること自体が目的化して、本体のプロト開発が止まる。今読んでいるこのドキュメントもその罠の入口になりうる。3節のロードマップだけ実行に移す。
- ✗ **数字感の不正確な判断で OS が乗っ取られる**: 「Sonnet がコストパフォーマンス良いはず」みたいな旧情報で意思決定する前に、`/usage` を一週間毎日見て体感を作る。
- ✗ **JV のメンバーに伝道する誘惑に早く乗る**: 自分が 3 週間使って腹落ちしてから "ちょっとマシ" を共有する程度に。組織的な権限設計や OpenTelemetry は、3人以上が日常的に使う段階になってから。

---

## 8. 元ドキュメントが触れていない補足トピック

### 8.1 Vercel + Next.js デプロイの落とし穴

- Server Action と Edge Runtime の互換性で躓きやすい。CLAUDE.md に「Server Action は Node Runtime 前提」と書いておく。
- 環境変数の `NEXT_PUBLIC_*` プレフィックスをクライアントに漏れる前提で扱う (CLAUDE.md に明記)
- Vercel Pro の DPA 締結状態と、Anthropic API / Gemini API の DPA 状態を分けて把握。Claude Code から Vercel のログを取りに行かせる場合、ログが第三者経由になる可能性に注意。

### 8.2 Gemini API を Claude Code が呼ぶケース

ローカル開発で Gemini API key を `.env.local` に書き、Claude Code が誤って読まないように `Read(./.env*)` の deny は必須。Gemini からの応答を hash して保存する場合、PII が含まれていないかも Claude に確認させる。

### 8.3 Leaflet の固有事項

- SSR 時に `window` 参照で落ちるので、`dynamic(() => import(...), { ssr: false })` が定型。CLAUDE.md に書いておくと毎回間違えない。
- タイル提供元の利用規約 (商用可否、レート制限) は Claude が読まないので、人間が確認。

---

## 9. 1ヶ月後にこのドキュメントを見直す視点

- Auto Memory が育って、CLAUDE.md がさらに薄くなったか?
- Plan Mode を「怖いから使う」から「安いから使う」に切り替えられたか?
- `/usage` を見るのが日常化したか?
- Subagent / Skill を1つ自分で作ったか? それとも作らずに済んだか?
- JV のメンバーで「ちょっと試したい」と言ってきた人がいたか? いたら settings.json をチーム共有できる形に整えるタイミング。

「ちょっとマシ」の蓄積を、ベストプラクティスの完璧主義で潰さないこと。

---

## 10. チートシート：User 側 / Claude Code 側の早見表

ベストプラクティスを2層に整理した一覧。困ったとき、どちらの層を見直せばいいかの羅針盤として。

### User 側 (人間が身につける運用)

| 場面 | やること | 詳細節 |
|---|---|---|
| **セッション開始** | 1セッション=1タスク。前のタスクと混ぜない | 3節 |
| **タスク開始** | フェーズ入口で `/plan` (3ファイル以上 or DB/認証/決済に触る) | 5.3節 |
| **計画承認後** | exit して Auto-accept、TodoWrite で 3〜6 ステップに分割 | 5.3節 |
| **各ステップ後** | `git diff` を読む。想定外なら `/plan` に戻る | 5.3節 |
| **コンテキスト管理** | `/context` で使用率確認、60% で `/compact`、2回失敗で `/clear` | 3節 |
| **フェーズ境界** | commit → `/clear` か `/compact` → 次フェーズの `/plan` | 5.3節 |
| **不可逆な操作前** | migration apply, push, deploy 直前は必ず Plan Mode に戻る | 5.3節 |
| **大きなファイル読込** | Subagent に渡して要約だけ受け取る | 3節 |
| **モデル選択** | メイン Opus 4.7 medium、Subagent は Haiku/Sonnet | 1.7節 |
| **日次** | `/usage` でコスト確認 | 3節 |
| **役割分担** | アーキ/データモデル/認証/UX根本設計は人間。命名/構文/定型は Claude | 5節 |
| **検証** | Claude の「成功した」報告を検証なしで信じない | 0節, 7節 |
| **学習** | AI 出力を手で書き直す。1日1回 Claude なしで何か書く | 論点8 |

### Claude Code 側 (ツールに仕込む設定)

| ファイル | 役割 | 規模目安 | 詳細節 |
|---|---|---|---|
| `./CLAUDE.md` | 客観的事実。build コマンド、規約、ハードルール | 200行以下 | 1.1節, 4節 |
| `./CLAUDE.local.md` | 個人環境固有 (.gitignore) | 必要なだけ | 4節 |
| `~/.claude/projects/<hash>/memory/` | Auto Memory (Claude が自動で書く) | 自動 | 1.1節 |
| `MEMORY.md` | Auto Memory のインデックス | 200行以下 | 1.1節 |
| `.claude/rules/*.md` | path-scoped にしたい大型ルール | 必要なだけ | 1.1節 |
| `.claude/skills/*/SKILL.md` | オンデマンドの playbook (3回以上やる作業) | 必要なだけ | 論点1 |
| `.claude/agents/*.md` | Custom Subagent (Month 2+) | 1つから | 論点1 |
| `./.claude/settings.json` | permissions, hooks (チーム共有) | - | Day 4-7, 4節 |
| `~/.claude/settings.json` | permissions, hooks (個人) | - | Day 4-7 |
| `.mcp.json` | MCP サーバー (必要時のみ) | 最小限 | 論点1 |

### 段階別の導入順序 (User側 / Claude Code側)

| タイミング | User 側で身につける | Claude Code 側で仕込む |
|---|---|---|
| **Day 1-3** | Plan Mode 既定、フェーズ境界の儀式、`/usage` 日次、`/clear` `/compact` `/context` | `./CLAUDE.md` (200行以下) |
| **Day 4-7** | diff を毎ステップ読むリズム | `settings.json` の deny ルール + 1つの PostToolUse Hook (lint/typecheck) |
| **Week 2-3** | 仕様駆動 (SPEC.md → /clear → 実装)、`/compact` `/clear` 反射神経化 | `.claude/rules/` で path-scoped ルール (必要なら) |
| **Month 1** | Subagent への委任を意識する | Skill を1つだけ作る (3回以上やる playbook) |
| **Month 2+** | 自分の運用パターンを言語化できているか棚卸し | Custom Subagent を1つ。MCP を必要に応じて |
| **触らない (当面)** | - | Agent Teams, Auto Mode, claude ultrareview, OpenTelemetry, 他者の Plugin |

### 困ったときの判断フロー

```
うまくいかない / トークンが焦げる / Claude が想定外のことをしている
        │
        ├─ User 側に問題? (規律・タイミング・判断)
        │   → Plan Mode 飛ばしてないか?
        │   → diff 読まずに次に進んでないか?
        │   → セッションに別タスク混ぜてないか?
        │
        └─ Claude Code 側に問題? (設定・ファイル)
            → CLAUDE.md が肥大化してないか?
            → MCP サーバー余計なの動いてないか?
            → Hook が遅延を生んでないか?
            → Subagent に渡すべきものを main で読んでないか?
```

**経験則**: トラブルの 7 割は User 側 (規律) の問題。Claude Code 側 (設定) を疑う前に、まず自分の運用を疑う。

