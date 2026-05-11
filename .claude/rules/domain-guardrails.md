---
description: Leaflet・TTS・Deno Edge Functions・Cache API・Supabase Realtime の実装 MUST ルール
globs: []
alwaysApply: true
---

## Leaflet（MUST）

- `dynamic(() => import(...), { ssr: false })` でラップ必須（`window` 参照でクラッシュ）
- `useEffect` クリーンアップで `map.remove()` 必須（Strict Mode 二重マウント対策）
- 地図コンテナに Tailwind `isolate` class を付けて Leaflet の z-index を閉じ込める

## TTS（MUST）

- `systemInstruction` は `gemini-2.5-flash-tts` では**サポートされない**（400エラーになる）
- スタイル指示は `contents` のテキスト先頭に自然言語の指示文として付加する
- `stylePrompt` は `SPEAKER_1:説明文` 形式にしない（台詞ラベルと混同して読み上げられる）
- 台本テキストは 4000 バイト以内（`stylePrompt` 分も合算される）
- 認証は `google-auth-library` + サービスアカウント鍵。Application Default Credentials は Vercel 環境では動かない場合がある

## Supabase Edge Functions（Deno）

- `process.env.X` → `Deno.env.get('X')`
- `require('lib')` → `import x from 'npm:lib'`
- 共通処理は `supabase/functions/_shared/` に配置

## Service Worker / Cache API

- `workbox-*` 導入禁止（手書き）
- キャッシュ名: `autodj-audio-v1`、キー: `/audio-cache/${audioFileId}`
- `register()` は `useEffect` 内で1回のみ

## Supabase Realtime

- ライブ位置共有（DB 書き込みなし）→ **broadcast**
- 管理画面の DB 変更リアルタイム反映 → **postgres_changes**
- `src/lib/realtime.ts` に集約し、コンポーネントから直接 `supabase.channel` を呼ばない
