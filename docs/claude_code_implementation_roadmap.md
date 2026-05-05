# AutoDJ Radio - Claude Code 実装ロードマップ（MVP最短ルート）

仕様書から洗い出したMVP到達までのステップ。
**1セッション1フェーズ**で進める。各フェーズの終わりにcommit→/clear。

---

## 前提：今の状態

- [x] DBスキーマ適用済み（Supabase）
- [x] v0フロント叩き台マージ済み
- [x] typecheck通過
- [x] .env.local作成済み
- [ ] Supabase接続未実装（スタブのまま）
- [ ] 認証未実装
- [ ] バックエンドAPI未実装

---

## フェーズ1：基盤整備（Supabase接続 + 認証）

**目標**：管理画面にログインできる状態にする

### Claude Codeへの指示

```
フェーズ1：Supabase接続と認証の実装

以下を順番に実装してください。Plan Modeで計画を出してから進めてください。

1. Supabaseクライアントの初期化
   - src/lib/supabase/client.ts（ブラウザ用）
   - src/lib/supabase/server.ts（Server Components用）
   - src/lib/supabase/admin.ts（Service Role用、Server側のみ）

2. 環境変数の型安全な読み込み
   - src/lib/env.ts（CLAUDE.md §9-1参照）

3. 認証実装
   - /login のメール+パスワード認証をSupabase Authに接続
   - ログイン成功後 /contents にリダイレクト
   - 未認証時は /login にリダイレクト（middleware.ts）
   - ログアウト（UserDropdownのスタブを実装）

4. rootユーザー作成スクリプト
   - scripts/setup-root-user.ts
   - Service Role経由でauth.usersに初期ユーザーを作成
   - 実行方法をREADMEに追記

制約：
- CLAUDE.md §9-3のアーキテクチャルールを守る
- Service Role keyはServer側のみ（クライアントバンドル禁止）
- サインアップ機能は実装しない（ログインのみ）
```

**完了条件**：`/login`でログインしてコンテンツ一覧が表示される

---

## フェーズ2：コンテンツ管理CRUD

**目標**：コンテンツの作成・編集・削除が実際に動く

### Claude Codeへの指示

```
フェーズ2：コンテンツ管理CRUDの実装

スタブ関数をSupabase接続に置き換えてください。

1. src/lib/api/contents.ts の実装
   - getContents(): contentsテーブルから全件取得（RLS準拠）
   - getContentById(id): 1件取得
   - createContent(data): INSERT
   - updateContent(id, data): UPDATE
   - deleteContent(id): DELETE

2. コンテンツ一覧画面（/contents）の接続
   - スタブをServer Actionsまたはapi関数に置き換え
   - ローディング状態（LoadingState）・エラー状態（ErrorState）を実装

3. コンテンツ編集画面（/contents/[id]）の接続
   - 保存ボタンでupdateContent実行
   - 新規作成（/contents/new）でcreateContent実行

4. 入力バリデーション
   - src/schemas/ のzodスキーマを使ってServer Actionの入出力を検証

制約：
- DBアクセスはsrc/lib/supabase/経由のみ（CLAUDE.md §4）
- Server Actionsの入出力はzodで検証（CLAUDE.md §9-1）
```

**完了条件**：コンテンツの作成・編集・削除がDBに反映される

---

## フェーズ3：AI台本化 + TTS音声生成

**目標**：テキストからAI台本化→音声ファイル生成が動く

### Claude Codeへの指示

```
フェーズ3：AI台本化とTTS音声生成の実装

1. Gemini Flash 台本化API
   - app/api/admin/scriptify/route.ts
   - 元テキストをGemini Flashに投げて読み上げ用台本に整形
   - プロンプトはsrc/prompts/scriptify.ts に分離
   - レスポンスをcontents.scriptに保存

2. Vertex AI TTS音声生成API
   - app/api/admin/tts/route.ts
   - src/lib/tts.ts に synthesize() 関数を実装（仕様書§3-4参照）
   - 生成音声をSupabase Storage audio-filesバケットに保存
   - audio_filesテーブルにレコード追加
   - 署名付きURLを返す

3. コンテンツ編集画面の接続
   - 「AIで台本化」ボタンを/api/admin/scriptifyに接続
   - 「音声を生成」ボタンを/api/admin/ttsに接続
   - 音声プレビュープレイヤーを実装（署名付きURL経由）
   - 音声生成モーダルのプログレス表示を実装

4. バリデーション
   - 台本テキストが4000バイト超の場合に警告表示（CLAUDE.md §9-4参照）

制約：
- TTS関数は将来の分割合成に対応できる構造で（仕様書§3-4）
- Gemini APIキーはServer側のみ
- 音声ファイル取得は署名付きURL経由（CLAUDE.md §9-3）
```

**完了条件**：コンテンツ編集画面でAI台本化→音声生成→プレビュー再生ができる

---

## フェーズ4：ラジオ番組管理 + Leaflet地図UI

**目標**：番組編集画面でLeaflet地図が動き、ピン配置ができる

### Claude Codeへの指示

```
フェーズ4：ラジオ番組管理とLeaflet地図UIの実装

1. Leaflet地図コンポーネント（管理画面用）
   - src/components/map/leaflet-map.tsx（Claude Code実装ガイドのStep D参照）
   - src/components/map/map.tsx（dynamic importラッパー、ssr:false）
   - 番組編集画面のプレースホルダーをLeafletコンポーネントに差し替え

2. 番組管理CRUD
   - src/lib/api/programs.ts の実装
   - getPrograms / getProgramById / createProgram / updateProgram / deleteProgram
   - radio_program_itemsの追加・削除も含む

3. 番組編集画面の地図インタラクション
   - 地図クリックで新規ピン追加
   - ピンクリックでコンテンツ選択ダイアログ
   - ピン削除
   - 路線ラインの表示（routePoints配列をPolylineで描画）
   - CSV/JSONインポート（緯度経度点列）

4. src/lib/geo.ts の実装（仕様書§4-3参照）
   - haversine(lat1, lng1, lat2, lng2): number
   - smoothGps(positions: Position[]): Position（直近3点移動平均）

制約：
- LeafletはSSR無効化必須（CLAUDE.md §9-2）
- geo.tsはhaversine一本化（ユークリッド距離不採用）
```

**完了条件**：番組編集でピン配置→保存がDBに反映される

---

## フェーズ5：ポーリングサイト管理 + Scheduled Edge Function

**目標**：Webサイトの自動ポーリングとコンテンツ自動生成が動く

### Claude Codeへの指示

```
フェーズ5：ポーリングサイト管理とバッチ処理の実装

1. ポーリングサイトCRUD
   - src/lib/api/polling-sites.ts の実装
   - /polling-sites 画面をDB接続

2. Supabase Scheduled Edge Function
   - supabase/functions/polling-cron/index.ts
   - 8時/12時/16時 JSTに実行
   - polling_sitesから有効サイト取得→HTTP GET→Gemini Flash要約→contents INSERT
   - 重複排除（同一URLで同一内容は追加しない）

3. ping cron（Free tier pause対策）
   - supabase/functions/ping/index.ts
   - 3日に1回 SELECT 1 を実行

4. ポーリング一覧画面に最終取得日時・ステータスを表示

制約：
- Edge FunctionはDeno環境（process.envではなくDeno.env.get()）
- import x from 'npm:lib' 形式（CLAUDE.md §Deno）
```

**完了条件**：手動でEdge Functionを実行するとコンテンツが自動生成される

---

## フェーズ6：車内クライアント実装

**目標**：タブレットで実際に位置連動音声再生ができる

### Claude Codeへの指示

```
フェーズ6：車内クライアントの実装

1. デバイストークン認証
   - /api/client/auth/route.ts
   - URLパラメータ ?bus=BUS_001 でバスID取得
   - devices.tokenと照合、bus_id特定
   - Service Role経由でSupabaseクエリ（RLSバイパス）

2. 番組データ取得API
   - /api/client/program/route.ts
   - bus_idに紐づく有効な番組と再生アイテム一覧を返す

3. 音声ファイル取得API（署名付きURL発行）
   - /api/client/audio/[id]/route.ts
   - CLAUDE.md §9-3の音声ファイル取得経路を実装

4. 再生モードのコアロジック実装
   - GPS watchPositionでリアルタイム位置取得
   - src/lib/geo.ts のhaversine + smoothGpsで位置判定
   - 10m以内に近づいたら音声をキューに追加
   - HTML5 Audio APIで順番に再生
   - trip / trip_playback_eventsへの記録

5. Supabase Realtime接続
   - 車載→broadcast（GPS更新、1Hz）
   - 仕様書§5-7のコードをそのまま実装

6. オフラインキャッシュ
   - Cache API / Service Workerで次5本をバックグラウンドキャッシュ
   - 通信断時はキャッシュで再生継続（仕様書§5-6）

7. 運行開始・終了フロー
   - 開始時にtripsテーブルにINSERT
   - 終了時にtrips.ended_atをUPDATE

制約：
- 車内クライアントはSupabaseに直接アクセスしない（/api/client/*経由）
- CLAUDE.md §9-3のアーキテクチャルールを厳守
```

**完了条件**：タブレットで番組を選択→走行中に位置連動で音声が再生される

---

## フェーズ7：仕上げ・動作確認

**目標**：実証走行できる状態にする

### Claude Codeへの指示

```
フェーズ7：仕上げと動作確認

1. バスマスタ管理（/buses）のDB接続
   - バス一覧・追加・デバイストークン発行の実装

2. 再生ログ（/logs）のDB接続
   - trips + trip_playback_eventsの表示

3. 設定画面（/settings）のDB接続
   - プロフィール編集・パスワード変更

4. エラーハンドリングの確認
   - 各API Routeにtryーcatchとエラーレスポンス
   - フロントのErrorState表示

5. pnpm lint && pnpm typecheck を通す

6. Vercelへのデプロイ確認
   - 環境変数をVercelダッシュボードに設定
   - pnpm build が通ることを確認
```

**完了条件**：Vercelにデプロイして実証走行できる状態

---

## 整合性チェック

### 中間チェック（Phase 3完了後に実施）

```
中間整合性チェックをお願いします。

以下を確認して、問題点と対処法をリストアップしてください。
実装はしないで、確認と報告だけしてください。

1. スタブの残存確認
   - src/lib/stubs.ts に残っている関数を列挙
   - @/src/lib/stub-api や @/lib/stub-api のimportが残っているファイルを列挙
   - TODO コメントが残っているファイルを列挙

2. 型の整合性
   - pnpm typecheck を実行してエラーを報告

3. 一気通貫の動作確認（手動確認のため手順を提示）
   - ログイン → コンテンツ作成 → AI台本化 → 音声生成 の手順を示す
   - 各ステップで確認すべきことを示す

4. Supabase RLS確認（SQL Editorで実行するSQLを提示）
   - 全テーブルでRLSが有効か確認するSQL
   - 認証済みユーザーがアクセスできるか確認するSQL

5. 環境変数の確認
   - .env.localに必要な変数が全部揃っているか
   - サーバー側でしか参照されるべきでない変数がNEXT_PUBLIC_になっていないか

報告形式：
- ✅ 問題なし
- ⚠️ 要確認（致命的ではないが後で対処が必要）
- 🔴 要修正（このまま進めると後で詰まる）
```

---

### 最終チェック（Phase 6完了後・デプロイ前に実施）

```
最終整合性チェックをお願いします。

デプロイ前の最終確認として、以下を確認して問題点をリストアップしてください。
修正が必要なものは優先度順に並べてください。

1. スタブ・TODOの完全除去確認
   - src/lib/stubs.ts のimportが残っているファイルを全て列挙
   - TODO / FIXME / stub コメントが残っているファイルを列挙
   - モックデータ（MOCK_XXX）が本番コードに残っていないか確認

2. セキュリティ境界の確認
   - SUPABASE_SERVICE_ROLE_KEY がNEXT_PUBLIC_になっていないか
   - Service Role keyをimportしているファイルがすべてServer側（API Route / Edge Function / Server Action）か
   - クライアントコンポーネント（'use client'付き）からService Role keyを参照していないか
   - 車内クライアントがSupabaseに直接アクセスしていないか（/api/client/*経由になっているか）

3. 型・Lintの確認
   - pnpm typecheck を実行してエラーを報告
   - pnpm lint を実行してエラーを報告

4. ビルドの確認
   - pnpm build を実行して通るか確認
   - ビルドエラーがあれば内容を報告

5. Supabase RLS確認（SQL Editorで実行するSQLを提示）
   - 全テーブルでRLSが有効か確認するSQL
   - RLSポリシーが正しく設定されているか確認するSQL

6. 環境変数チェックリスト（Vercelデプロイ用）
   - Vercelに設定が必要な環境変数の一覧を出力
   - .env.localの変数名と値のサンプルを整理

7. 一気通貫の動作確認手順
   以下のシナリオを手動で確認するための手順を提示：
   - 管理者ログイン → コンテンツ作成 → AI台本化 → 音声生成 → 音声プレビュー
   - ラジオ番組作成 → ピン配置 → 保存
   - 車内クライアント起動 → 番組選択 → 再生モード → GPS位置連動確認

報告形式：
- ✅ 問題なし
- ⚠️ 要確認（致命的ではないが対処推奨）
- 🔴 要修正（デプロイ前に必ず直す）

🔴が全部解消されたらデプロイOKとする。
```

---

## 進め方のルール

**1セッション1フェーズ**
- フェーズ完了 → `git commit` → `/clear` → 次フェーズ

**Plan Modeの使い方**
- プロンプトを投げる → 計画を確認 → 「進めて」で実装
- 計画が想定と違う場合はその場で修正指示

**詰まったら**
- エラーメッセージをそのまま投げる
- 「このエラーを直して」だけでOK

**MQTT・Termux（3.5mm入力）**
- フェーズ6の後、動作確認後に追加実装
- 実機で試してうまくいかなければUIトグルのままでも実証可能

---

## MVP到達の判断基準

以下が全部動けばMVP完了：

- [ ] 管理画面にログインできる
- [ ] コンテンツを作成・編集・削除できる
- [ ] AIで台本化→音声生成→プレビューできる
- [ ] ラジオ番組を作成・ピン配置できる
- [ ] ポーリングサイトを登録してバッチ実行できる
- [ ] タブレットで番組選択→位置連動音声再生ができる
- [ ] Vercelにデプロイして外部からアクセスできる
