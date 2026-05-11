# Vercel デプロイチェックリスト

---

## 1. Vercel ダッシュボードの環境変数

Settings → Environment Variables で以下を設定（全 Environment: Production / Preview / Development）

| 変数名                                | 必須  | 値の取得元                     | 備考                                          |
| ---------------------------------- | --- | ------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`         | ✅   | Supabase → Settings → API | `https://xxxx.supabase.co`                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | ✅   | Supabase → Settings → API | **publishable key**（旧: anon public key）     |
| `SUPABASE_SERVICE_ROLE_KEY`        | ✅   | Supabase → Settings → API | **secret key**（旧: service_role key）絶対に公開しない |
| `GOOGLE_SERVICE_ACCOUNT_JSON`      | ✅   | GCP → サービスアカウント → キー JSON | 1行に圧縮した JSON 文字列（下記参照）                      |
| `GCP_PROJECT_ID`                   | ✅   | GCP プロジェクト ID             | 例: `my-project-123`                         |
| `GCP_LOCATION`                     | ✅   | Vertex AI リージョン           | `us-central1`（デフォルト）                        |
| `GEMINI_TTS_MODEL`                 | 任意  | —                         | デフォルト: `gemini-2.5-flash-tts`               |
| `GEMINI_SCRIPTIFY_MODEL`           | 任意  | —                         | デフォルト: `gemini-2.5-flash`                   |
| `NEXT_PUBLIC_TRIGGER_RADIUS_M`     | 任意  | —                         | デフォルト: `10`（GPS 判定半径 m）                     |
| `NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN` | 任意  | —                         | デフォルト: `5`（ウェイポイントタイムアウト 分）                 |
| `NEXT_PUBLIC_AUDIO_TIMEOUT_SEC`    | 任意  | —                         | デフォルト: `120`（音声取得タイムアウト 秒）                  |

> **`GOOGLE_SERVICE_ACCOUNT_JSON` の注意点**: Vercel は改行を含む値を扱えないため、JSON を 1 行に圧縮して貼る必要があります。
>
> ```bash
> cat service-account.json | jq -c . | pbcopy  # macOS
> ```

---

## 2. Supabase Edge Functions のシークレット

`poll-sites` 関数が参照するシークレットを設定（`supabase secrets set` コマンド）:

```bash
supabase secrets set \
  SUPABASE_URL=https://xxxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  GCP_PROJECT_ID=my-project-123 \
  GCP_LOCATION=us-central1 \
  GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

または Supabase ダッシュボード → Edge Functions → **Manage secrets** から設定可。

---

## 3. Supabase 側の確認事項

| 項目 | 確認内容 |
|---|---|
| Auth → Email プロバイダ | サインアップ無効・サインインのみ有効になっていること |
| Storage → `audio-files` バケット | Private（公開アクセス不可）になっていること |
| RLS ポリシー | migrations で設定済みであること |
| Edge Functions スケジュール | `poll-sites`（1日3回）・`ping-keep-alive`（3日1回）が有効になっていること |

---

## 4. ビルド警告への対処（任意）

`pnpm build` に出ていた警告：

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

Next.js 16 から `src/middleware.ts` → `src/proxy.ts` へのリネームが推奨されています。今はビルドは通りますが、将来削除される可能性があります（1ファイルのリネームで済みます）。

---

## 5. デプロイ後の動作確認手順

1. `https://your-app.vercel.app/login` → 管理者ログイン確認
2. `/contents` → コンテンツ一覧の表示・作成
3. `/buses` → バス追加・トークン表示
4. `/programs/[id]` → 番組アイテム追加・保存
5. TTS 生成（`/contents/[id]`）が Vertex AI へ到達できるか
6. 車内クライアント `/client/setup` → デバイストークン登録 → `/client/play` の GPS 連動再生
