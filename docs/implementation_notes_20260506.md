# フェーズ7 実装ノート

仕様書対応状況レポート（フェーズ1〜6）を受けた設計判断と実装方針。
Claude Codeへの引き継ぎ情報として保管。

---

## 🔴 フェーズ7前に対処すること（実機テストで確実に詰まる）

### 1. 進行方向インクリメント（Uターン・折り返しで再発火バグ）

**現状の問題**

現状の実装は「ピンから10m以内に入ったら再生」という単純な距離判定。
バスがUターンしたり折り返したりすると、一度再生済みのピンにまた10m以内に入って
同じ音声が2回再生されるバグが発生する。

**採用する設計：インデックス進行 + 通過判定 + タイムアウトフォールバック**

番組編集時に`radio_program_items.sequence`カラムで再生順を設定し、
車内クライアントは「現在のターゲットインデックスのアイテムとのみ近傍判定」する。

```
通常フロー：
  現在のターゲット（sequence=N）に近づく
  → 10m以内に入る
  → 音声再生開始
  → 再生完了 or 通過判定でsequence N+1へ進む

通過判定：
  現在のターゲットへの距離が「近づいてから再び遠ざかった」ことを検出したら通過とみなして次へ
  （距離の最小値を記録し、最小値から20m以上離れたら通過）

フォールバック（バグ対策）：
  タイムアウトN分経過したら強制的にsequence+1へ進む
  （GPSが取れなかった・通過判定が失敗した場合の保険）
  Nの目安：路線長と停留所間隔から決める。デフォルト5分。
  環境変数 NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN で調整可能にする
```

**実装上の注意**

- 現在のシーケンス番号をtripsテーブルかlocalStorageに保持する
- トリップ開始時はsequence=0（最初のアイテム）からスタート
- 全アイテムを再生済み（またはスキップ）したらトリップ完了
- trip_playback_eventsにstatus='skipped'を記録してスキップを追跡可能にする

**Claude Codeへの指示文**

```
src/app/(client)/client/play/page.tsx の位置判定ロジックを以下の設計に修正してください。

現状：全アイテムへの単純距離判定
変更後：インデックス進行 + 通過判定 + タイムアウトフォールバック

1. 現在のターゲットインデックス（currentSequenceIndex）をstateで管理
2. currentSequenceIndexのアイテムとのみ近傍判定（10m以内）
3. 通過判定：距離の最小値を記録し、最小値から20m以上離れたら次のインデックスへ
4. タイムアウト：NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN（デフォルト5分）経過で強制的に次へ
5. スキップ時はtrip_playback_eventsにstatus='skipped'で記録
6. radio_program_itemsはsequenceカラムの昇順で処理する

環境変数 NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN を .env.local と docs/testing_client.md に追記してください。
```

---

### 2. 120秒タイムアウト未実装（キュー詰まりで無限待機）

**現状の問題**

音声ファイルの取得やネットワーク遅延で再生キューが止まった時、ずっと待ち続ける状態になる。
実機では通信が不安定な場面が必ずあるため、無限待機は致命的。

**採用する設計**

- 音声取得（署名付きURL発行 + fetchバイナリ）に120秒のタイムアウトを設定
- タイムアウト発生時はtrip_playback_eventsにstatus='failed'を記録してスキップ
- UIにPlaybackErrorDialogを表示して「スキップ」か「再試行」を選択させる

**Claude Codeへの指示文**

```
src/app/(client)/client/play/page.tsx の音声再生ロジックに120秒タイムアウトを追加してください。

1. /api/client/audio/[id] へのfetchと音声バイナリ取得を合わせて120秒でAbortControllerでキャンセル
2. タイムアウト発生時：
   - trip_playback_eventsにstatus='failed'を記録
   - PlaybackErrorDialogを表示（スキップ or 再試行）
   - スキップ選択時は次のキューアイテムへ
   - 再試行選択時は同じアイテムを再度試行（最大3回）
3. 120秒はNEXT_PUBLIC_AUDIO_TIMEOUT_SEC環境変数で調整可能にする
```

---

### 3. バス管理・再生ログのDB実接続

**現状の問題**

/admin/busesと/admin/logsがまだスタブデータ表示。
実際のDBと繋がっていないため、バスの登録・デバイストークン発行・再生履歴の確認ができない。
運行管理の実務に直結する。

**Claude Codeへの指示文**

```
以下の2ページをSupabase実接続に切り替えてください。

1. src/app/(admin)/buses/page.tsx
   - stubs.tsのgetBuses/createBus/disableBusをsrc/lib/api/buses.tsに実装
   - busesテーブルとdevicesテーブルをJOINしてデバイストークン情報も表示
   - デバイストークン発行：gen_random_uuid()でdevicesテーブルにINSERT
   - 無効化：devices.is_active=falseにUPDATE

2. src/app/(admin)/logs/page.tsx
   - stubs.tsのgetTrips/getPlayEventsByTripId/getBusesをsrc/lib/api/logs.tsに実装
   - tripsテーブルとbusesテーブルをJOINして表示
   - trip選択でtrip_playback_eventsを取得して右ペインに表示
   - vehicle_location_logsも件数表示

CLAUDE.md §4のアーキテクチャルール（DBアクセスはsrc/lib/supabase/経由）を守ってください。
```

---

## 🟡 後で対応すること（実証には影響しない）

### 4. MQTT / 3.5mm入力連携

**現状**：UIトグルのダミー実装のみ。src/lib/mqtt.ts未実装。

**本来の設計**：
- Tab M11でTermuxが常駐し、audio_monitor.pyが3.5mmジャック入力レベルを監視
- 閾値超えを検出したらHiveMQ Cloud（MQTT）にpublish
- 車内クライアントがMQTT.jsでsubscribeして外部音声ON/OFFを切り替え

**対応タイミング**：実機（タブレット + 車内アナウンスシステム）が揃ってから。

**実装時の参照先**：
- docs/TODO_polling.md（MQTTブローカー設定の参考）
- 仕様書§5-8、§14-2

---

### 5. broadcastペイロードのheading/speed追加

**現状**：{lat, lng, ts}のみ送信。仕様書では{lat, lng, heading, speed, ts}。

**影響**：管理画面でバスの進行方向矢印を表示したい時に対応が必要。

**対応時の注意**：
- src/lib/realtime.tsのペイロードスキーマを変更
- 購読側（管理画面）にも変更が波及する

---

### 6. キャッシュバージョニングのハードコード

**現状**：Service Worker内のキャッシュ名が'autodj-audio-v1'でハードコード。

**問題**：デプロイ後も古いキャッシュが使われ続けるリスク。

**対応案**：ビルド時にnext.config.tsでキャッシュ名を書き換えるスクリプトを追加。
または`public/sw.js`のキャッシュ名をデプロイ時に自動更新するGitHub Actionsを設定。

---

## ⚪️ 仕様書・CLAUDE.mdの整備

### 7. shadcn/uiの正式採用をCLAUDE.mdに明記

CLAUDE.mdの§6「UIコンポーネントライブラリ禁止」からshadcn/uiを除外して正式採用を明記する。

```
変更前：UIコンポーネントライブラリ（shadcn/ui等）は要相談
変更後：shadcn/uiは採用済み・積極的に使う。他のUIライブラリは引き続き要相談
```

### 8. SWRの使用承認をCLAUDE.mdに記録

logs/page.tsxとbuses/page.tsxでSWRが使用済み。CLAUDE.mdの依存管理セクションに追記。

### 9. マルチスピーカーTTSをADRに追加

src/lib/tts.tsでSPEAKER_1 + SPEAKER_2のマルチスピーカー構成を採用。
docs/adr/にADRとして記録する。

---

## フェーズ7の実施順序

```
1. shadcn/ui・SWR承認をCLAUDE.mdに反映（5分）
2. 進行方向インクリメント実装（最も複雑、Plan Modeで計画を出させてから）
3. 120秒タイムアウト実装
4. バス管理・再生ログDB接続
5. 最終チェックプロンプト実行（docs/claude_code_implementation_roadmap.md参照）
6. Vercelデプロイ・クラウド動作確認
7. MQTT実装（実機が揃ってから）
```
