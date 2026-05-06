# TODO: ポーリング機能の本格実装

**ステータス**: MVP非採用（Edge Functionのファイルは残存、scheduleは無効化済み）
**優先度**: Phase 2以降
**作成日**: 2026年5月

---

## やりたいこと

自治体・観光地等のWebサイトを定期巡回して、新着情報を自動的にコンテンツとして取り込む。

**具体的なユースケース**:
- 町田市公式サイトのお知らせ一覧（`https://www.city.machida.tokyo.jp/shisei/koho/koho/announce/index.html`）
- 新着記事が追加されたら自動取得→台本化→contentsテーブルに保存

**期待される動作**:
1. `polling_sites`テーブルに登録されたURLを1日3回巡回（8時/12時/16時 JST）
2. HTML取得→テキスト抽出→Gemini Flashで要約・台本化
3. `contents`テーブルに`source_type='polling'`で保存
4. 同一URLでも前回から差分があれば新規コンテンツとして追加（完全一致は重複排除）

---

## MVPで断念した理由

### 発生したエラー

```
Gemini 出力の JSON パース失敗: Unterminated string in JSON at position 116
先頭: {"title": "町田市役所から最新のお知らせ！", "summary": "町田市に新しい副市長が2名就任...
```

`maxOutputTokens: 2048`に増やしても解消せず。JSONが途中で切れる。

### 根本的な問題

現状の設計（ページ全体のHTMLをそのままGeminiに投げる）には以下の問題がある：

1. **トークン不足**：HTML全体を投げると入力が長くなり、出力のJSON構造が途中で切れる
2. **一覧ページの問題**：`/announce/index.html`のような一覧ページを要約すると「〇〇のお知らせがあります」という薄い内容になる。本来は個別記事URLまで辿って中身を取得すべき
3. **差分検出が粗い**：「完全一致は重複排除」では一覧ページの微妙な変化を検出しにくい

---

## 本格実装時の設計案

### アーキテクチャ（2ステップポーリング）

```
Step 1: 一覧ページ監視
- 一覧ページのHTMLを取得
- 前回取得分とのリンクURLの差分を検出
- 新規URLをキューに追加

Step 2: 個別記事取得
- キューの各URLにGETリクエスト
- 本文テキストを抽出（不要なHTML除去）
- Gemini Flashで台本化（文字数制限を明示したプロンプト）
- contentsに保存
```

### 改善が必要な点

**HTMLパース**:
- `cheerio`等でHTMLから本文テキストを抽出してからGeminiに渡す
- `<script>` `<style>` `<nav>` `<footer>`等のノイズを除去
- 入力テキストを4000バイト以内に収める（Gemini TTS制限と同じ観点で）

**Geminiへのプロンプト改善**:
- 出力文字数を明示指定（title: 30文字以内、summary: 80文字以内、script: 200文字以内）
- `responseMimeType: 'application/json'`を使いつつ、コードブロック除去も保険として実装
- `maxOutputTokens: 4096`以上を設定

**差分検出の改善**:
- 一覧ページのリンクURLリストをハッシュ化して前回と比較
- 新規URLが追加された時だけ個別記事を取得
- `polling_sites.settings`にlastSeenUrlsを保存

**エラーハンドリング**:
- サイトごとにtry-catchして1サイトのエラーが他に波及しない設計（仕様書§10-2）
- `last_status='failure'`と`last_error`にエラー内容を記録して管理画面で確認できるように

### 依存ライブラリ候補
- `cheerio`：HTMLパース（Node.js版jQuery）
- `node-html-parser`：軽量HTML→テキスト変換

---

## 現状のコードの場所

```
supabase/functions/poll-sites/index.ts  ← Edge Function本体（scheduleは無効化済み）
src/app/(admin)/polling-sites/          ← 管理画面（CRUD実装済み）
src/lib/api/polling-sites.ts            ← APIスタブ→DB接続済み
```

手動実行（テスト用）:
```bash
supabase functions serve poll-sites --env-file .env.local

curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/poll-sites' \
  --header 'Authorization: Bearer <local-anon-key>' \
  --header 'Content-Type: application/json'
```

定期実行を有効化する場合は`supabase/config.toml`に追加:
```toml
[functions.poll-sites]
verify_jwt = false
schedule = "0 23,3,7 * * *"

[functions.ping-keep-alive]
verify_jwt = false
schedule = "0 0 */3 * *"
```

---

## Claude Codeへの引き継ぎプロンプト（本格実装時）

```
ポーリング機能を本格実装してください。

背景：
- MVPではHTMLをそのままGeminiに投げる設計でJSONパースエラーが頻発したため非採用
- 詳細はdocs/TODO_polling.mdを参照

実装方針：
1. 2ステップポーリング（一覧ページ監視→個別記事取得）
2. cheerioでHTMLから本文テキストを抽出してからGeminiに渡す
3. Geminiへの出力文字数を明示指定（title:30文字、summary:80文字、script:200文字）
4. maxOutputTokensは4096以上
5. サイトごとにtry-catchして1サイトのエラーが他に波及しない設計
6. 差分検出をリンクURLのハッシュ比較に改善

既存コード：
- supabase/functions/poll-sites/index.ts（要リファクタ）
- src/lib/api/polling-sites.ts（CRUD実装済み、変更不要）
- polling_sitesテーブルのsettings(jsonb)にlastSeenUrlsを保存可能

web searchでcheerioのDeno対応状況と最新のGemini Flash APIの
JSON出力安定化のベストプラクティスを確認してから実装してください。
```
