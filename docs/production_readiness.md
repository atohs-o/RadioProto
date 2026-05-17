# 本番デプロイ前チェックリスト

PoCから本番運用に移行する前に対応すべき事項。
優先度順に整理。

---

## 🔴 必須（本番投入前に必ず対応）

### 1. ログ基盤の整備

**常時ONのイベントログ**

`trip_events`テーブルを追加して以下を記録：
- trip開始・終了（理由付き）
- GPS信号ロスト・復帰
- サーバー接続断・復帰
- 異常系発火（タイムアウト・強制終了等）
- 認証失敗

距離ログの間引き設計：
- 通常時：10秒ごとに記録
- POIから100m以内：1秒ごとに記録

**ログの自動アーカイブ（Supabase Storage退避）**

pg_cronで毎日深夜に実行：
1. 30日以上前の`trip_events`をJSONに集約
2. Supabase StorageのバケットにアップロードS（`logs/YYYY-MM-DD.json`）
3. DBから削除

理由：Supabase無料枠500MBの圧迫防止。StorageはDB枠と別（1GB）。

### 2. 観測性（Sentry導入）

フロント・APIの未捕捉例外をSentryに送る。
「何が起きているか見えない」状態が一番危険。

```bash
pnpm add @sentry/nextjs
```

最低限の設定：
- 未捕捉例外の自動キャプチャ
- requestIdの伝播
- PIIマスキング（GPS座標・メールアドレス）

### 3. GPS異常値フィルタ

現状の実装に追加：
- 座標が(0,0)の場合は無効値として無視
- 前回位置から1秒で1km以上移動した場合はジャンプとして無視
- `coords.accuracy`が100m以上の場合は精度低下として`low-accuracy`扱い

### 4. LLM出力のZodバリデーション強化

台本化・TTS生成のAPIレスポンスをZodで検証。
失敗時は再生成（最大1回）またはエラーをユーザに通知。

現状：JSONパース失敗でクラッシュする可能性あり（ポーリングで実証済み）。

### 5. コスト上限の回路遮断

GCPの予算アラート（設定済み）に加えて、アプリ側でも制御：
- 日次のTTS生成回数をSupabaseで管理
- 上限（例：50件/日）に達したらAPI呼び出しを止めてエラー表示
- 管理画面で上限設定を変更できるようにする

---

## 🟡 推奨（本番投入後できるだけ早く）

### 6. セキュリティヘッダー

Next.jsの`next.config.ts`に追加：
```typescript
headers: [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
]
```

### 7. 依存ライブラリのCVE管理

GitHubのDependabotを有効化して週次でCVEチェック。
重大なCVEが出たら即対応。

### 8. DBマイグレーションの運用ルール

本番適用前に必ずローカルでテスト。
破壊的変更（カラム削除等）は expand → migrate → contract の3段階で。

### 9. キャッシュバージョニング

Service Workerのキャッシュ名`autodj-audio-v1`がハードコードされている。
デプロイ時にビルド番号を自動で書き換えるスクリプトを追加。

### 10. 端末スリープ復帰後の状態同期

Androidタブレットがスリープから復帰した時に：
- GPS watchPositionを再開
- Supabase Realtime接続を再確認
- 音声キャッシュの整合性チェック

### 11. 主要ボタンの連打防止

再生開始・運行終了ボタンにdebounceを追加。
二重trip作成の防止。

---

## ⚪️ 本番運用が軌道に乗ってから

### 12. SLO定義

最低限定義すべき指標：
- 再生開始成功率（目標：99%以上）
- 起動から最初の音声まで（目標：p95で5秒以内）
- GPS判定精度（目標：正しいPOIで95%以上発火）

### 13. Game Day（カオスエンジニアリング）

四半期に1回、以下のシナリオを手動で発生させて耐性を確認：
- GPS信号を意図的にロスト
- Vertex AIを一時停止
- Supabase Realtime接続を切断
- ポケットWi-Fiをオフ

### 14. MDM（モバイルデバイス管理）

複数台のタブレットを管理する場合：
- キオスクモードの一括設定
- OTAアップデートの管理
- 紛失時のリモートワイプ

### 15. ポーリング本格実装

現状はMVP非採用。Pythonスクリプトへの移行。
詳細は`docs/TODO_polling.md`参照。

### 16. MQTT / 3.5mm入力連携

実機（タブレット + 車内アナウンスシステム）が揃ってから。
詳細は`docs/phase7_implementation_notes.md`参照。

---

## 参考：リソース上限と監視

| サービス | 無料枠上限 | 監視場所 |
|---|---|---|
| Supabase DB | 500MB | ダッシュボード → Usage |
| Supabase Storage | 1GB | 同上 |
| Vercel | 帯域100GB/月 | ダッシュボード → Usage |
| MapTiler | 10万ロード/月 | cloud.maptiler.com/account/statistics |
| GCP（TTS/Gemini） | 従量課金 | console.cloud.google.com/billing |

GCPのみ予算アラート設定済み（$20/月でメール通知）。
他は月1回ブックマークから確認。

---

## 関連ドキュメント

- `docs/TODO_polling.md`：ポーリング本格実装の設計
- `docs/phase7_implementation_notes.md`：MQTT・残タスク
- `docs/hardware_checklist.md`：実機ハードウェア構成
- `docs/testing_client.md`：動作確認手順
- リサーチ結果（異常系ハンドリングベストプラクティス）：`docs/`に保存推奨
