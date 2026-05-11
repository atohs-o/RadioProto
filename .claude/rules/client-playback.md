---
description: 車内クライアント再生フロー・音声取得経路・番組アイテム関係・revalidatePath 一覧
globs:
  - "src/app/(client)/**"
  - "src/app/api/client/**"
  - "src/app/(admin)/programs/**"
  - "src/app/api/admin/tts/**"
  - "src/lib/geo.ts"
  - "src/lib/api/contents.ts"
alwaysApply: false
---

## 車内クライアントのフロー

```
/client           → 番組選択
/client/setup     → デバイストークン登録（localStorage 保存）
/client/confirm   → 確認
/client/play      → GPS トリガー型音声再生（メイン画面）
```

`/client/play`（`src/app/(client)/client/play/page.tsx`）の主要処理:
- `NEXT_PUBLIC_TRIGGER_RADIUS_M`（デフォルト 10m）以内に入ったら **現在 sequence ターゲットのみ** キューに追加
- sequence 管理: `sequence` 昇順でターゲットを1件ずつ追跡。再生完了/通過/タイムアウトで N+1 へ進む
  - Pattern A（正常）: 10m 圏内 → 再生完了 → N+1
  - Pattern B（通過）: 圏内進入後 `PASS_THROUGH_MARGIN_M`(20m) 以上離れる → `skipped` → N+1
  - Pattern C（タイムアウト）: `NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN`（デフォルト 5 分）圏外のまま経過 → `skipped` → N+1
- GPS は直近3点の移動平均でスムージング（`src/lib/geo.ts` の `smoothGps`）
- 音声は Cache API に先読み（名前: `autodj-audio-v1`、キー: `/audio-cache/${audioFileId}`）
- 音声取得は `NEXT_PUBLIC_AUDIO_TIMEOUT_SEC`（デフォルト 120 秒）で AbortController タイムアウト
- objectURL は再生終了・エラー・運行終了時に必ず `URL.revokeObjectURL()` で解放

## 音声ファイルの取得経路

```
車内クライアント
  → GET /api/client/audio/[id]（X-Device-Token 付き）
  → API Route が Service Role で署名付き URL 生成（1時間有効）
  → 署名付き URL を返す → クライアントが Storage から直接取得
```

`audio-files` バケットは非公開。直接アクセス不可。

## 番組アイテムと音声ファイルの関係

コンテンツは音声を複数持てる（再生成のたびに `audio_files` レコードが追加される）。

- `contents.metadata.active_audio_file_id` — 現在使用する音声ファイル ID
- `radio_program_items.audio_file_id` — 番組アイテムに紐づいた音声ファイル ID

**`saveProgramAction`（`src/app/(admin)/programs/actions.ts`）のパターン**:
- アイテムを全削除 → 全再挿入（upsert ではない）
- 挿入時に `contents.metadata.active_audio_file_id` を DB から引いて `audio_file_id` をセット

**`getContents()`（`src/lib/api/contents.ts`）のパターン**:
- `audio_files` を結合取得するとき `metadata.active_audio_file_id` で対応ファイルを選ぶ（order 未指定のため `[0]` は不定）

## Server Actions の `revalidatePath`

コンテンツの音声を変更したとき、`/programs` キャッシュも無効化が必要。

| Action | revalidatePath |
|---|---|
| `updateContentAction` | `/contents`, `/contents/${id}` |
| `setActiveAudioAction` | `/contents/${id}` |
| `saveProgramAction` | `/programs`, `/programs/${id}` |

音声生成（`/api/admin/tts`）は API Route のため `revalidatePath` を呼べない。管理画面でページ再読み込みが必要な場合がある。
