# モビリティ車内音声コンテンツシステム 機能仕様書(改訂版)

最終更新:2026年5月1日
本仕様書は、Golden Week 期間に着手するプロトタイプ実装の指針として、Claude Code への入力を前提に整理したもの。

---

## 0. 改訂方針と本仕様書の使い方

### 0-1. 主要な設計判断(初版からの変更点)

| 領域 | 初版 | 改訂版 | 理由 |
|---|---|---|---|
| Realtime 通信 | プロト=ポーリング、本番=WebSocket | 最初から Supabase Realtime broadcast | 移行による書き直し負債を回避、Free tier に含まれる |
| 定期実行 | GitHub Actions cron | Supabase Scheduled Edge Functions | DB との物理距離・統合・運用監視の単純化(GitHub Actions は次点フォールバック) |
| 距離計算 | 100m を境にユークリッド/ハヴァーサインを切替 | ハヴァーサイン一本化 + GPS 平滑化 | ユークリッドは lat/lng で歪む、最適化として価値なし、平滑化未対応はバグの温床 |
| 再生済み管理 | `radio_program_items.再生済みフラグ` | `trips` + `trip_playback_events` | 永続フラグは2回目運行で全スキップする構造バグ |
| 空間判定 | (PostGIS 想定) | クライアント側完結(`@turf/boolean-point-in-polygon`) | 規模に対し過剰、オフライン要件で結局クライアント実装が必要 |
| TTS モデル | Gemini 3.1 TTS(preview) | Vertex AI `gemini-2.5-flash-tts`(stable) | preview は2週間予告で deprecate される可能性、業務用途は GA を選択 |
| 3.5mm 入力検出 | 未確定 | Termux + Python + HiveMQ Cloud(MQTT)、**MVP 実装** | 電源 ON で自動稼働、ブローカ自前不要、将来の他センサ拡張に流用可 |
| 自動起動 | Phase 2 | **MVP 実装**(MacroDroid + Termux:Boot)、ただし MDM/キオスクモードは Phase 2 のまま | 実証用途で「ドライバーは2タップのみ」を実現、エンタープライズ管理は本番展開時に追加 |
| TTS 長文分割 | 最初から組み込み | **MVP では実装せず**、インターフェースの拡張余地のみ確保 | 観光案内台本は2-3分で制限内、扱うコンテンツが制限を超える確率が低い |
| テキスト手入力 | COULD | **MUST**(直接入力 → AI 台本化 → 手編集の3点セット) | 自動収集だけだと素材自由度が低い、商材として「自動化と人間の編集の両立」を見せる |

### 0-2. 表記規約

- **決定事項**:変更不可。データモデル・API 契約・認証・セキュリティに関わる。
- **推奨案**:Claude Code が最終判断する余地を残す(根拠は §10 に集約)。
- **オープン**:意図的に未確定にしている領域。実装過程の対話で詰める(§0-3 参照)。
- **Phase 2 / 将来計画**:MVP スコープ外、ただし DB 設計には拡張余地を残す。

### 0-3. 意図的にオープンにする領域(vibe coding 前提)

本仕様書は「後から変えたときの破壊範囲が大きいもの」を固め、「実装してみて初めて筋の良さが分かるもの」をオープンにしている。以下の領域は、本仕様書で具体的な記述があっても**Claude が壁打ち中に置いた仮置き(placeholder)**であり、実装過程で詰める前提。Claude Code はこれらを「未定義=自由に決めていい」ではなく、「**最も素朴な実装で進めて、出力を見てから対話で詰める**」と解釈すること。

#### A. UI / UX の細部(v0 出力後に詰める)

仕様書に列挙した画面要素はリストとして妥当だが、レイアウト・操作フロー・状態遷移の細部はオープン。具体的には:

- §3-2 コンテンツ一覧画面の表示密度・列順・絞り込み UI
- §3-3 コンテンツ編集画面のタブ構成 vs 1ページ縦長
- §4-6 ラジオ番組編集画面の地図と編集パネルの分割比
- §5-3 番組確認画面のステータス表示の温度感
- §5-4 再生モード画面のレイアウト(地図・キュー・現在再生の配置)
- 音声生成中のプログレス表現
- エラー表示の温度感(警告 / エラーの色・文言)
- ピンの色分けルール(再生済み / 再生待ち / 再生中)

**運用方針**:v0 で複数バリエーション素描 → Claude Code でブラッシュアップ → 翔太さんが見て違和感ベースで対話修正。仕様書の列挙は「**この情報が画面のどこかにあればいい**」という機能要件であって、レイアウト指定ではない。

#### B. LLM プロンプトの本体(実装→出力評価→改善ループで詰める)

§2-2 の「Gemini Flash で要約・台本化」のプロンプト本体はオープン。観光案内の台本は「読み上げ前提のリズム」「2-3分の長さ」「固有名詞の読み仮名」「冒頭フック」などの要件が複合的で、机上で固めるより**出力 → 音声化 → 聞いてみる**のループで調整するのが筋。

**運用方針**:
- プロンプトは `src/prompts/` に集約、コード内ハードコード禁止
- バリエーション比較しやすい構造(プロンプト名 + 入力テンプレート + few-shot)で管理
- 初期版は「素朴な要約プロンプト」で動かし、現場フィードバックで改善
- この改善プロセス自体が商材の差別化(顧客デモ時に「現場フィードバックで台本品質を高速改善できる構造」として説明可)

#### C. 地図 UI の操作性(最素朴実装→違和感ベースで詰める)

§4-6 の番組編集画面の操作 UX はオープン。具体的には:

- ピンのドラッグ移動可否
- 路線ラインの編集 UX(点を後から挿入・削除する手順)
- ピン作成 → コンテンツ選択 vs その逆のフロー
- 路線データのインポート画面(CSV プレビュー、エラー表示)
- 地図ズーム・センタリングのデフォルト挙動

**運用方針**:Claude Code に「最も素朴な Leaflet 標準実装で」と指示し、使ってみて違和感が出たら直す。事前に詰めても徒労になりやすい領域。

#### D. オープン領域の判定基準(Claude Code 向け)

判断に迷ったら以下のテストを使う:

> **「この決定を後から変えたとき、DB スキーマや API 契約、他コンポーネントへの影響はあるか?」**
> - YES → 固めるべき領域。仕様書 or 対話で確認してから進む
> - NO → オープン領域。最素朴実装で進めて、後で対話で詰める

---

## 1. システム全体構成

```
[管理画面] ← ルートユーザーが操作(MVP は1ロールのみ)
   ↓
 Supabase(DB / Storage / Auth / Realtime / Edge Functions)
   ↑
[Scheduled Edge Functions] ← 1日3回(8時 / 12時 / 16時 JST)
   ↑
 Web(ポーリング対象サイト)

[車内クライアント] ← Tab M11 ブラウザ(デバイストークン認証)
   ↓ ↑
 Vercel API Route(オンデマンド TTS、各種読み書き)
   ↓ ↑
 Supabase Realtime(broadcast / postgres_changes)

[3.5mm 入力ヘルパー] ← Termux + Python(タブレット内常駐)
   ↓
 HiveMQ Cloud MQTT broker
   ↓
 車内 Web クライアントが MQTT.js で subscribe
```

### 1-1. リアルタイム通信方針(決定事項)

- **読み(サーバー→車載 / 車→管理画面・乗客)**:Supabase Realtime broadcast
- **書き(車載→DB)**:軌跡ログは30秒に1回 INSERT、ライブ位置は broadcast のみ(DB書き込みなし)
- **3.5mm入力イベント**:MQTT pub/sub(MVP は UI トグルのダミー)

### 1-2. 定期実行方針(決定事項)

- **採用**:Supabase Scheduled Edge Functions
- **次点フォールバック**:GitHub Actions cron(Edge Functions に詰まった場合の切替先。書き換え対象は cron 関数本体のみで、DB スキーマ・フロントには影響しない)

---

## 2. 情報収集パイプライン(旧 Web ポーリング機能)

### 2-1. ポーリング対象サイト管理(MUST)

- URL、サイト名、有効/無効フラグの CRUD
- ポーリング頻度は MVP では固定(1日3回)
- 一覧画面に「最終取得日時」「最終成功/失敗ステータス」を表示(顧客デモで信頼性アピール)

### 2-2. ポーリング実行(MUST)

**実行時刻:8時 / 12時 / 16時 JST**

日本の Web 更新パターンに合わせた推奨タイミング:
- 朝刊系・行政発表は8〜10時に集中 → 8時実行
- 昼の更新は12〜14時 → 12時実行
- 夕方の追加情報は16〜18時 → 16時実行
- 夜間は更新が少ないため非実行(コスト・無駄を削減)

**処理フロー**:
1. `polling_sites` から有効サイト一覧取得
2. 各サイトに HTTP GET、HTML 取得
3. Gemini Flash API で要約・台本化
4. `contents` テーブルに `source_type='polling'` で保存
5. 同一 URL でも前回取得時から差分があれば新規コンテンツ候補として追加(完全一致は重複排除)

### 2-3. Free Tier 自動 pause 対策(MUST)

- Supabase Free tier は7日間 API アクセスがないと自動 pause される
- ポーリングが1日3回稼働している間は実質 pause されないが、サービス停止期間に備えた保険として実装
- **対策:3日に1回、軽量な ping cron を別途実行**(Edge Function で `SELECT 1` を投げるだけ)

### 2-4. 将来機能(Phase 2)

- キーワード指定でポーリング対象サイト候補を自動探索

---

## 3. コンテンツ管理機能

### 3-1. コンテンツの種類

| 種類 | MVP | 説明 |
|---|---|---|
| Web ポーリング | ✅ MUST | 定期バッチによる自動収集・要約 |
| テキスト手入力 | ✅ MUST | 直接入力 → Gemini で台本化(任意で AI 整形をスキップ可) |
| URL 指定 | △ COULD | ユーザー指定 URL の手動取得・要約 |
| ファイルアップロード | ❌ Phase 2 | PDF / 画像 の OCR・要約 |

**MVP の「テキスト手入力」フロー**:
1. ユーザーがテキストエリアに元情報を入力(例:イベント告知文、観光地解説の素案)
2. 「AI で台本化」ボタンで Gemini Flash に投げ、読み上げ用台本に整形
3. 台本確認・編集画面で**ユーザーが手で編集可能**(§3-3)
4. 保存

**設計意図**:Web ポーリングだけだと素材の自由度が低い。テキスト手入力 + AI 台本化 + 手編集の3点セットで「**運用者が触りながら品質を上げる体験**」が完結し、商材として「自動化と人間の編集が両立する」ことを見せられる。

### 3-2. コンテンツ一覧画面(MUST)

表示項目:タイトル / 概要 / 作成日 / 最終更新日 / ソース分類タグ / 内容分類タグ / 音声化ステータス / ラジオ登録ステータス
操作:検索・絞り込み、新規作成、編集、削除

### 3-3. コンテンツ編集画面(MUST)

- タイトル・台本テキスト編集
- 内容分類タグ(MVP は自由テキスト、Phase 2 でマスタ化)
- 音声生成ボタン → Vercel API Route → Vertex AI `gemini-2.5-flash-tts`
- 音声プレビュー再生
- 音声再生成

### 3-4. TTS API 仕様の制約と対策(決定事項)

- `gemini-2.5-flash-tts` の制約:**text 4000バイト / prompt 4000バイト / 合計8000バイト上限、出力音声は最大約655秒**
- 通常の観光案内台本(2-3分=数百〜千バイト程度)は十分収まる
- **MVP では長文分割合成は実装しない**(扱うコンテンツが制限を超える可能性が低いため)
- ただし**インターフェースだけ拡張余地を残す**:TTS 呼び出し関数は `synthesize(scriptText: string): Promise<AudioFile>` ではなく、内部的にチャンク配列を扱える構造で書いておく(Phase 2 で分割 → 結合ロジックを足すだけで済むように)
- バリデーション:台本保存時にバイト数を計測し、上限超過時は警告表示(MVP)
- モデル名は環境変数化:`process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-tts'`(将来 3.1 GA への差替え容易化)

### 3-5. 新規作成フロー(MVP)

- **ポーリング(MUST)**:バッチで自動生成、手動作成なし
- **テキスト手入力(MUST)**:テキストエリア入力 → 「AI で台本化」ボタンで Gemini 整形(または整形スキップ) → 台本確認・編集 → 保存
- **URL 指定(COULD)**:URL 入力 → コンテンツ取得 → AI 要約 → 台本確認・編集 → 保存

**共通**:いずれのソースも、保存後の編集画面(§3-3)でテキスト手編集可能。AI が生成した台本も、最終的にユーザーが触れる前提。

---

## 4. ラジオ番組管理機能

### 4-1. ラジオ番組の定義(決定事項)

「ラジオ番組」とは、音声コンテンツと位置情報のセットを複数まとめたもの。

**構成要素**:
- 番組名
- 番組タイプ(`route_bus` / `on_demand`、MVP は `route_bus` のみ)
- 音声コンテンツ × 位置情報のセット(複数登録可能)
- 有効/無効フラグ

### 4-2. 番組タイプ:路線バス型(MUST)

**概念**:決まったルート上に再生地点を離散配置、シーケンスマッチング

**マッチングロジック**:
- 現在位置を路線上にマッピング、次の再生地点を一意に特定
- 距離が10m 以内になったら音声を再生キューに追加
- マッチング完了 or 通過したら次の地点にインクリメント
- マッチング対象は常に唯一(進行方向に沿って一方向)

### 4-3. 距離計算と GPS 平滑化(決定事項)

**ハヴァーサイン距離一本化**(ユークリッド距離による最適化は採用しない)
- ユークリッド距離は lat/lng で歪む(緯度45度で経度1度=約79km)
- 数十点に対してハヴァーサインを毎秒走らせる計算量は Tab M11 でも誤差レベル
- ハヴァーサイン関数は `src/lib/geo.ts` に集約

**GPS 平滑化**(必須)
- 直近3点の移動平均で位置を平滑化
- GPS は都市部で5〜15m 誤差、トンネル前後でジャンプする
- 生の距離だけで「10m 手前」を判定すると、瞬間的な GPS 飛びで予定地点を「通過判定済み」になり再生されないバグが起きる
- 平滑化関数も `src/lib/geo.ts` に集約

### 4-4. 路線データ登録(MVP)

**MVP 採用**:
- 地図 UI 上のクリックで点を順番に登録
- CSV / JSON インポート(緯度経度点列)

**Phase 2**:
- GTFS 静的データのインポート(国土交通省等が公開する公共交通オープンデータ)

### 4-5. 番組タイプ:オンデマンド型(Phase 2)

**MVP では実装しない**が、DB スキーマには `program_type` を最初から含める(後付けマイグレーションを避けるため)。

**(参考)Phase 2 マッチングロジック**:
- エリア内の全コンテンツ再生地点を面上に配置
- 現在位置から同心円(または前方180°扇形)内の上位N件をキャッシュ候補
- 候補を移動に伴い再計算、圏外は削除、圏内追加
- 再生地点の10m手前で再生キューに追加
- 再生済みフラグは `trip_playback_events` で管理(永続フラグは持たない)

### 4-6. ラジオ番組編集画面(地図 UI、MUST)

- Leaflet + React Leaflet + OSM
- 路線形状をライン表示
- コンテンツをピンで配置
- 紐付け済みセットの一覧(位置名称・コンテンツタイトル・音声長)
- ピンの位置・コンテンツ変更・削除
- 番組名編集・保存

### 4-7. バス × ラジオ番組の対応(MVP)

- バス1台、番組1個を1対1固定で対応
- バスマスタは作るが、QR コード印刷は Phase 2(MVP は URL パラメータで `?bus=BUS_001` を渡す)
- DB の `buses.qr_code_id` カラムは UUID で自動生成しておく(将来 QR 化に対応)

---

## 5. 車内クライアント機能

### 5-1. 認証(MUST)

- デバイストークンを Tab M11 ブラウザの localStorage に保存
- URL パラメータ `?bus=BUS_001` でバス ID 取得
- 起動時に自動認証

### 5-2. ラジオ番組選択画面(MUST)

- サーバーから有効な番組一覧を取得して表示
- 番組名・登録コンテンツ数を表示
- MVP では1番組のみなので自動選択でも可

### 5-3. 番組確認・開始フロー(MUST)

- 登録コンテンツ一覧表示(位置・タイトル)
- GPS 受信状況・サーバー通信状況チェック
- ステータス表示(正常 / 警告 / エラー)
- OK で再生モードへ移行
- 開始時に近い順で次の5本をバックグラウンドキャッシュ

### 5-4. 再生モード画面(MUST)

- Leaflet + OSM 上に現在位置をリアルタイム表示
- 再生位置をピン表示(再生済み / 待ち / 中で色分け)
- 位置判定ロジック(路線バス型):
  - 現在位置を路線上にマッピング、次の再生地点を一意に特定
  - 進行方向に沿って一方向にインクリメント
  - 通過時は次の地点へ
- 再生キュー管理(キューに入った音声が120秒以上再生されないまま場合は自動削除)
- 外部音声入力連携:**MVP は UI トグル(ダミー)のみ**
  - 本番想定:MQTT 経由で 3.5mm 入力イベント受信、ON 時は一時停止

### 5-5. ステータス表示(SHOULD)

| 項目 | 内容 |
|---|---|
| GPS 受信状況 | 受信中 / 未受信 / 精度低下 |
| サーバー通信状況 | 接続中 / 切断 / タイムアウト |
| 現在の再生状況 | 再生中コンテンツ名・残り時間 |
| キュー状況 | 待機中コンテンツ数 |
| 外部音声入力状況 | ON / OFF |

### 5-6. オフライン対応(MUST)

- Cache API / Service Worker で次5本の音声をバックグラウンドキャッシュ
- 通信断時はキャッシュで再生継続
- GPS はタブレット側で動作継続(位置判定は通信断でも動く)
- 通信復帰後に自動で次音声を補充
- 再生済み音声はキャッシュから順次削除

### 5-7. リアルタイム通信(決定事項):Supabase Realtime

**車載クライアント → broadcast(GPS 更新ごと、1Hz)**:

```typescript
const channel = supabase.channel(`bus:${busId}`, {
  config: { broadcast: { self: false, ack: false } }
})
await channel.subscribe()

navigator.geolocation.watchPosition((pos) => {
  channel.send({
    type: 'broadcast',
    event: 'location',
    payload: {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      ts: Date.now()
    }
  })
})
```

**車載クライアント → DB 軌跡ログ(30秒間引き)**:

```typescript
setInterval(() => {
  supabase.from('vehicle_location_logs').insert({
    trip_id, bus_id, lat, lng, recorded_at: new Date()
  })
}, 30_000)
```

**乗客スマホ・管理画面側(subscribe)**:

```typescript
const channel = supabase.channel(`bus:${busId}`)
channel
  .on('broadcast', { event: 'location' }, ({ payload }) => updateMap(payload))
  .subscribe()
```

**設計意図**:
- broadcast は DB 書き込みなしの pub/sub のみ → 1Hz でも Free tier で余裕
- 軌跡ログは30秒間引きで永続化 → DB 肥大化を抑制、分析用途
- 車載自身の位置判定は broadcast 往復に依存しない(GPS 取得 → ローカル判定 → 再生のループ)

### 5-8. 3.5mm 入力ヘルパー(Termux + Python + HiveMQ、MUST / MVP 実装)

**構成**:
1. Tab M11 起動時、**Termux:Boot で Python スクリプト自動起動**(電源 ON で勝手に稼働状態になる)
2. `sounddevice` で 3.5mm 入力レベル監視(閾値超え検出、ヒステリシス付きで OFF→ON / ON→OFF を判定)
3. HiveMQ Cloud(無料 tier、月10000メッセージまで)へ MQTT publish:
   - topic:`bus/{busId}/external_audio`
   - payload:`{"status": "on" | "off", "ts": ...}`
4. 車載 Web アプリは MQTT.js で subscribe → 一時停止 / 再開

**採用理由**:
- 電源 ON で自動稼働(Termux:Boot は MacroDroid より枯れていて壊れにくい)
- ブローカ自前不要(HiveMQ Cloud serverless 無料 tier)
- 他センサ拡張(車速、ドア開閉)も同じ仕組みで載る

**MVP 段階のフォールバック**:
- 実機検証で MQTT 連携がうまくいかない場合、UI トグル(ダミー)で先に動くものを通し、ヘルパー連携は後追い実装に回す
- ただし**Termux:Boot による Python 自動起動部分は MVP で必ず動かす**(ブラウザ自動起動と同じ仕組みのため、§14-2 参照)

---

## 6. 乗客向けインターフェース(Phase 2)

MVP スコープ外。DB スキーマには `passenger_*` テーブルを最初から含めておく。

仕様詳細(初版仕様書 §6 を踏襲):
- 認証不要の視聴画面(QR コード経由でアクセス)
- ユーザー登録後の対話セッション(Claude API)
- マイページ(対話履歴・お気に入り)

---

## 7. 認証・ロール設計

### 7-1. ロール一覧

| ロール | MVP | 認証方法 | 権限 |
|---|---|---|---|
| ルートユーザー | ✅ MUST | メール / PW | フルアクセス |
| 編集者 | ❌ Phase 2 | メール / PW | グループ内編集 |
| 閲覧者 | ❌ Phase 2 | メール / PW | グループ内閲覧 |
| 車内クライアント | ✅ MUST | デバイストークン | 番組選択・再生 |
| 乗客(未登録) | ❌ Phase 2 | なし | 視聴 |
| 乗客(登録済) | ❌ Phase 2 | メール / SNS | 対話セッション |

### 7-1-b. 認証経路と RLS の設計(決定事項)

**ルートユーザー**:
- Supabase Auth(`auth.users`)で認証 → JWT に `auth.uid()` が乗る
- RLS は `is_root()` ヘルパー関数で `profiles.role = 'root'` を確認して許可
- MVP は1ユーザーのみ。**Supabase ダッシュボードで Email サインアップを無効化**し、Service Role 経由で唯一のユーザーをセットアップスクリプトで作成する(仕様書 §12-1)

**車内クライアント**:
- `auth.users` を介さない(デバイストークンによる別系統認証)
- DB アクセスは **Next.js API Route 経由で Service Role キーを使用**(RLS バイパス)
- API Route 内でデバイストークンを `devices.token` と照合 → `bus_id` を取得 → 必要なデータのみ返す
- **車内クライアント自身は Supabase クライアントを使わず、API Route と通信する**(クライアントに anon key すら渡さない)
- ただし Realtime broadcast は別:車内クライアントから直接 Supabase Realtime に subscribe する場合は、API Route 経由で短期間有効な broadcast 用トークンを発行する設計を検討(MVP では anon key を埋め込んで簡易実装、Phase 2 で厳格化)

**Phase 2 での厳格化**:
- broadcast 用トークンの短期発行(JWT カスタムクレーム + RLS)
- 編集者・閲覧者ロール用の `is_editor()` / `is_viewer_in_group()` ヘルパー関数追加
- グループ単位のテナント分離

### 7-2. グループ概念(Phase 2)

DB スキーマには `groups`, `group_users` を最初から定義しておくが、MVP では使用しない(全 `*.group_id` を NULL 許容)。

---

## 8. データベース設計(Supabase)

### 8-1. 設計原則(決定事項)

- **MVP で使わないカラムも、Phase 2 で追加されることが確実なものは最初から定義**(マイグレーション規模を抑制)
- **再生履歴は trip 単位で記録**(永続フラグでの管理は禁止)
- **テーブル単位の追加は後付けでも安価、カラム追加・カラム意味変更は高価**
- **座標は `numeric(9, 6)`(精度約11cm)、点列・ポリゴンは `jsonb`**(PostGIS 不採用、§10-3)
- **JSONB カラムの `metadata` と `settings` の使い分け**(下記)

#### `metadata` と `settings` の使い分け(命名規約)

| カラム名 | 用途 | 編集主体 | 例 |
|---|---|---|---|
| `metadata` | **記録・観測値**(その時点の状態を残す) | システム自動 | 生成時のモデル名、エラー詳細、再生中断理由 |
| `settings` | **設定値**(ユーザーが意図的に変更する) | ユーザー / 管理者 | ポーリング頻度、近接判定半径、表示オプション |

**判断基準**:「**この値を後から書き換えると過去のデータの意味が変わるか?**」
- YES → settings(設定値、書き換え前提)
- NO → metadata(履歴・観測値、不変が望ましい)

例:
- `audio_files.metadata.tts_model = 'gemini-2.5-flash-tts'` → 生成時の状態、後から書き換えてはいけない
- `polling_sites.settings.frequency = 'daily_3times'` → ユーザーが変えたい設定

両方が必要な場合はカラムを2つ持つ(`metadata` + `settings`)。

### 8-2. テーブル一覧

#### 管理系
- `groups`(MVP 未使用、スキーマのみ)
- `users`(MVP は `role='root'` のみ)
- `group_users`(MVP 未使用)
- `devices`(車内タブレットのデバイストークン)
- `buses`(`qr_code_id` を UUID で持つ)
- `bus_radio_assignments`(バス × 番組、`is_active` で切り替え)

#### コンテンツ系
- `polling_sites`
- `contents`(`source_type`:'polling' / 'url' / 'file' / 'manual')
- `audio_files`(Storage URL)
- `radio_programs`(`program_type`:'route_bus' / 'on_demand'、MVP は `route_bus` のみ)
- `radio_program_items`(番組 × 位置 × 音声、**再生済みフラグは持たない**)
- `routes`(緯度経度点列)
- `route_stops`(路線バス型のシーケンス順)
- `ondemand_areas`(Phase 2、ポリゴン定義)

#### 運行記録系(MUST、決定事項)
- `trips`(`bus_id`, `program_id`, `started_at`, `ended_at`)
- `trip_playback_events`(`trip_id`, `item_id`, `played_at`, `status`:'played' / 'skipped' / 'failed')
- `vehicle_location_logs`(`trip_id`, `bus_id`, `lat`, `lng`, `recorded_at`)

**設計意図**:
- 再生済みかどうかは `trip_playback_events` を JOIN して判定
- 運行のたびに新しい trip が作られるので、フラグのリセットが自動
- 仕様 §16-5 の分析(人気コンテンツ、GPS 精度、通信品質)の基盤になる

#### 乗客系(Phase 2、スキーマのみ定義)
- `passenger_users`
- `passenger_sessions`
- `passenger_session_messages`
- `passenger_favorites`

---

## 9. 技術スタック

| レイヤー | 採用技術 | 備考 |
|---|---|---|
| フロントエンド | Next.js + TypeScript | v0 で素描 → Claude Code でブラッシュアップ |
| ホスティング | Vercel(Hobby) | MVP は無料、本番化時に Pro 検討 |
| データベース | Supabase Postgres(東京リージョン ap-northeast-1) | Free tier で開始 |
| 認証 | Supabase Auth | RLS と統合 |
| ファイルストレージ | Supabase Storage | 音声ファイル |
| **リアルタイム通信** | **Supabase Realtime(broadcast / postgres_changes)** | 最初から採用、移行なし |
| **定期実行** | **Supabase Scheduled Edge Functions** | 1日3回ポーリング + 3日に1回 ping、Free tier 50万呼び出し / 月 |
| AI 要約・台本化 | Gemini Flash API(GCP) | 学習利用なし設定、Vertex AI 経由推奨 |
| AI 対話セッション | Claude API(Phase 2) | Anthropic、API 鍵は MVP 段階で取得 |
| **音声合成** | **Vertex AI `gemini-2.5-flash-tts`(stable)** | モデル名は環境変数化 |
| 地図 UI | Leaflet + React Leaflet + OSM | 完全無料 |
| 空間判定 | `@turf/boolean-point-in-polygon` | クライアント側、PostGIS 不要 |
| MQTT | MQTT.js + HiveMQ Cloud(無料 tier) | 3.5mm 入力連携(Phase 2 本実装) |
| オフラインキャッシュ | Cache API / Service Worker | ブラウザ標準 |
| IDE | Cursor + Claude Code | Privacy モード ON |

---

## 10. アーキテクチャ意思決定の根拠(推奨案の説明)

Claude Code が最終判断する際の文脈として、各推奨の根拠を明文化する。

### 10-1. なぜ Supabase Realtime を最初から採用するか

- **当初案(初版)**:プロト=ポーリング、本番=WebSocket 移行
- **問題**:移行が大規模な書き直しになる(購読パターン、状態管理、再接続ロジック)
- **判断**:Supabase Realtime は Free tier に含まれ、追加コストなし。後から書き直す技術負債を抱える理由がない
- **代替**:詰まったら短期的に setInterval ポーリングに退避可能(購読インターフェースは既に書かれているので、本実装に戻すコストは低い)

### 10-2. なぜ Edge Functions を採用するか(GitHub Actions ではなく)

**推奨理由**:
- DB との物理距離が近い(東京リージョン同士)→ 数百件の読み書きで GitHub Actions より高速・低コスト
- Supabase の認証 / RLS と自然に統合
- ログ・シークレット・cron が1箇所に集約 → 運用監視が単純化
- Free tier:月50万呼び出し、現状利用想定(月90回 + 3日に1回 ping)の遥か上

**認識しているデメリット**:
- Deno ランタイム(Node ではない、ネイティブモジュールに制約)
- 実行時間制限(最大400秒程度、長時間バッチには分割が必要)
- ローカル開発が GitHub Actions YAML より複雑
- エコシステムが薄い(再試行・通知は自前)

**フォールバック**:Edge Functions に詰まった場合は GitHub Actions cron に切り替え。書き換え対象は cron 関数本体のみ、DB スキーマ・フロントには影響しない

### 10-3. なぜ PostGIS を採用しないか

- **規模**:1番組数十点、毎秒判定でも計算量問題なし(Tab M11 で誤差レベル)
- **オフライン要件**:車載は通信断で動作必須 → 判定ロジックはクライアントに置く必要あり、DB にも置くと二重管理
- **後付け可能**:将来スケールで必要なら追加するのみ、既存スキーマを壊さない
- **代替**:`@turf/boolean-point-in-polygon` でポリゴン点内判定もクライアント完結

### 10-4. なぜ TTS は Vertex AI 経由か(AI Studio Direct ではなく)

- **規制対応**:Vertex AI は SOC 2 / HIPAA 対応、業務利用前提では必須
- **データ残存ポリシー**:有料 tier で学習利用なしを契約レベルで保証
- **東京リージョン**:データレジデンシー要件
- **モデル選定**:`gemini-2.5-flash-tts` は GA stable、ナレーション用途で必要十分(Pro は感情表現・対話で効くモデルで過剰)
- **Preview を避ける理由**:`gemini-3.1-flash-tts-preview` は2週間予告で deprecate される可能性、業務システムで採用するには時期尚早

### 10-5. なぜ trips テーブルを最初から作るか

- 旧仕様の `radio_program_items.再生済みフラグ` は構造的バグ:2回目運行で全コンテンツがスキップされる
- trip 単位の記録なら自動リセット(運行ごとに新 trip 生成)
- 仕様 §16-5 の分析機能の基盤になる(後付けマイグレーションを避ける)

### 10-6. なぜハヴァーサイン一本化、ユークリッド削除か

- ユークリッド距離は lat/lng で歪む(緯度45度で経度1度=約79km、緯度依存)
- 数十点での毎秒計算は Tab M11 でも誤差レベルの負荷
- 最適化として書く価値がない、むしろバグの温床
- GPS 平滑化(直近3点平均)は必須(GPS 飛びによる「通過判定済み」バグの根治)

### 10-7. なぜ 3.5mm は MQTT を採用するか

- ブラウザから 3.5mm = オーディオ入力を直接検出する手段は実質ない(Web Serial API はシリアル通信で別物、`getUserMedia` は kiosk モードでパーミッションが鬼門)
- ネイティブヘルパー(Python)からブラウザに通知する手段として、MQTT は:
  - ブローカ自前不要(HiveMQ Cloud)
  - WebSocket より接続管理が枯れている
  - 将来の他センサ・他車両イベントに同じ仕組みで載る
- localhost HTTP も代替として可だが、管理画面・乗客スマホへの中継拡張で書き直しになる

---

## 11. MVP スコープ(MoSCoW)

「**1路線・1番組・10〜20音声・自動収集→台本→音声合成パイプラインを売りに**」を踏まえた切り分け。

### MUST(MVP に含む、売りの核)

**情報収集 → 台本化 → 音声合成パイプライン**:
- ポーリング対象サイト CRUD
- ポーリングバッチ(1日3回:8時 / 12時 / 16時 JST)
- Gemini Flash で要約・台本化、`contents` に保存
- **テキスト手入力 → AI 台本化(Gemini)→ 手編集**(§3-1, §3-5)
- 台本編集画面(AI 生成台本もユーザーが手で編集可能)
- 音声生成ボタン(Vertex AI `gemini-2.5-flash-tts`、長文分割なし)
- 音声プレビュー

**ラジオ番組管理**:
- 番組 CRUD(路線バス型固定)
- 路線データ:地図クリック追加 / CSV インポート
- 地図 UI で番組編集

**車載クライアント**:
- デバイストークン認証
- 番組選択 → 確認 → 再生モード
- ハヴァーサイン位置判定(GPS 平滑化付き)
- キュー管理、120秒タイムアウト
- オフラインキャッシュ(次5本)
- **3.5mm 入力ヘルパー連携(Termux + Python + MQTT 経由)**(§5-8)

**車内運用(自動起動)**:
- **Termux:Boot による Python ヘルパーの電源 ON 自動起動**(§14-2 A)
- **MacroDroid による Chrome 自動起動 + 全画面表示**(§14-2 B)
- ドライバー操作は番組選択の2タップのみ

**バス管理**:
- バス1台のみ、URL パラメータ `?bus=BUS_001` で識別
- バス × 番組 1対1固定

**認証**:
- ルートユーザー1人のみ(Supabase Auth)

**運行記録**:
- `trips` 自動生成、`trip_playback_events` 記録、`vehicle_location_logs` 30秒間引き

### SHOULD(時間あれば)

- ポーリングサイト一覧の最終取得日時・成否表示(信頼性アピール)
- 台本再生成ボタン(同ソースから別バリエーション)
- 車載クライアントの簡易ステータス表示(GPS / 通信 / キュー / MQTT 接続)

### COULD(余力)

- URL 指定での手動コンテンツ追加

### WON'T(MVP 外、Phase 2)

- ファイルアップロード(PDF / 画像 OCR)
- オンデマンド交通型番組
- 編集者・閲覧者ロール、グループ管理
- 乗客向けインターフェース全部
- TTS 長文分割合成(インターフェースの拡張余地は残す、§3-4)
- GTFS インポート
- 監視・ログダッシュボード
- 番組 × 時間帯切り替え
- **キオスクモード、Android Enterprise / MDM**(自動起動は MacroDroid + Termux:Boot で実現、MDM は本番展開フェーズ)
- 複数バス対応
- QR コード印刷・運用

### 「最初から仕込む」テーブル拡張余地(決定事項)

| カラム / テーブル | MVP 値 | 後で追加 |
|---|---|---|
| `radio_programs.program_type` | 'route_bus' | 'on_demand' |
| `radio_programs.group_id` | NULL or default | グループ管理 |
| `users.role` | 'root' | 'editor', 'viewer' |
| `contents.source_type` | 'polling', 'manual' | 'url', 'file' |
| `buses.qr_code_id` | UUID 自動生成 | QR 印刷で使用 |
| `trips`, `trip_playback_events` | 1運行=1trip | 履歴分析の基盤 |

**スキーマで先回りしないもの**(後付けで足すだけで済む):
- `groups`, `group_users` テーブル(NULL 許容で逃げる)
- `polling_sites` の頻度・条件カラム(JSONB `settings` で逃げる)
- 監視・ログ系テーブル

### 工数感(参考)

- Pre-v0 TODO:2-3日
- v0 でフロント素描:2-3日
- Claude Code でブラッシュアップ・統合:10-14日
- 検証・修正:3-5日
- **合計:実働2-3週間**

---

## 12. Pre-v0 事前対応 TODO

### 12-1. インフラ準備

- [ ] Supabase プロジェクト作成(東京リージョン ap-northeast-1)
- [ ] Supabase CLI セットアップ、`supabase init`
- [ ] DB スキーマを `supabase/migrations/` に SQL で記述・適用(初期 migration:`20260501000000_initial_schema.sql`)
- [ ] **Supabase ダッシュボードで Email サインアップを無効化**(Authentication > Providers > Email > "Enable signup" を OFF)— MVP は Service Role 経由で唯一の root ユーザーを作る運用
- [ ] **唯一の root ユーザーを Service Role API 経由で作成**(`supabase.auth.admin.createUser` を使ったセットアップスクリプトを `scripts/setup-root-user.ts` に置く)
- [ ] `supabase gen types typescript --linked > src/types/database.types.ts` で型自動生成、CI で自動再生成
- [ ] Vercel プロジェクト作成、Supabase の env を連携(anon key と service role key の使い分けに注意:後者は API Route のみで使用)
- [ ] Google Cloud プロジェクト作成、Vertex AI API 有効化、東京リージョン設定
- [ ] サービスアカウント鍵作成、Vercel env に登録
- [ ] Anthropic API 鍵を Vercel env に登録(Phase 2 用、先に取得)
- [ ] **HiveMQ Cloud 無料 tier アカウント作成、broker URL / credentials 取得**(MVP の MQTT 連携で使用)
- [ ] **Free tier auto-pause 対策の ping cron**(3日に1回 `SELECT 1` を投げる Edge Function)実装

### 12-1-b. Tab M11 セットアップ(MVP 実機検証)

実機が手元に届いたら以下を順に実施。詳細手順は §14-2、検証項目は §14-6。

- [ ] Tab M11 入手、初期設定(Google アカウント連携)
- [ ] **Termux + Termux:Boot をインストール**(F-Droid から推奨、Play Store 版は古い)
- [ ] Termux で Python 環境構築(`pkg install python`、`pip install paho-mqtt sounddevice`)
- [ ] `audio_monitor.py` を `~/.termux/boot/` に配置、起動スクリプト動作確認
- [ ] **MacroDroid をインストール**、デバイス起動 → Chrome URL 起動マクロを設定
- [ ] Chrome で車内クライアント URL を「ホームに追加」→ PWA 化
- [ ] 電源 OFF → ON で自動起動が完走するか実測(目標1分以内)
- [ ] HiveMQ Cloud との MQTT pub/sub の疎通確認

### 12-2. コード設計準備

- [ ] zod スキーマ定義(API 入出力すべて、`src/schemas/` 集約)
- [ ] DB types と zod スキーマの source of truth ルール整理
- [ ] `src/lib/geo.ts` にハヴァーサイン関数・GPS 平滑化関数を集約
- [ ] 環境変数一覧の整理(`SUPABASE_URL`, `GEMINI_TTS_MODEL` 等)

### 12-3. Claude Code 着手前に整理させる

- [ ] `CLAUDE.md` 作成(内容は §12-4 を参照)
- [ ] Supabase MCP server 接続設定
- [ ] zod スキーマ⇄ DB types の関係性整理を Claude Code に対話で詰めさせる

### 12-4. Claude Code 実装ガードレール(`CLAUDE.md` に記載する内容)

Claude Code が陥りやすい癖を事前に封じるため、`CLAUDE.md` に以下を明記する。

#### パッケージマネージャ・依存追加

- **`pnpm` 使用、`packageManager` フィールドを `package.json` に明記**(npm/yarn と混在させない、lock ファイル二重化を防止)
- **依存追加は事前承認制**:Claude Code が勝手に新規ライブラリを `pnpm add` しない。追加が必要な場合は理由とともに提案させる
- **特に追加禁止**:
  - `workbox-*`(Service Worker は手書き、§5-6 のキャッシュロジックを Claude Code に書かせる)
  - 状態管理ライブラリ(MVP は React 標準の `useState` / `useReducer` / Context で十分、Zustand/Jotai/Redux は不要)
  - UI コンポーネントライブラリ(MVP は素の Tailwind、shadcn/ui を使う場合は要相談)

#### Service Worker / Cache API

- **手書き必須**(workbox 等のラッパー禁止)
- キャッシュ対象:音声ファイルのみ(現在地に基づく次5本、§5-6)
- キャッシュ削除:再生済み音声は順次削除
- バージョニング:`CACHE_NAME` を環境変数で管理、デプロイごとに変えて古いキャッシュをパージ
- Claude Code に丸投げすると古い workbox パターンを書きがちなので、**最初に骨格を翔太さんが書く or レビューしてから委譲**

#### Leaflet + React Strict Mode

- **`useEffect` のクリーンアップ必須**(map.remove() を return で呼ぶ、StrictMode の二重マウントで二重初期化バグの定番)
- 地図インスタンスは `useRef` で保持
- React Leaflet を使うなら `MapContainer` の `key` を適切に設定(再マウント制御)
- ポップアップ・マーカーの管理は React 状態と Leaflet 状態の同期に注意(状態を Leaflet 側に持たせない、React を source of truth に)

#### Supabase Realtime

- **broadcast と postgres_changes を混同しない**:
  - **broadcast**:DB 書き込みなしの pub/sub(本仕様書 §5-7 のライブ位置共有はこちら)
  - **postgres_changes**:DB の INSERT/UPDATE/DELETE を購読(管理画面のリアルタイム更新で使うならこちら)
- broadcast 実装サンプルは §5-7 を参照、ハードコード禁止で `src/lib/realtime.ts` に集約
- subscribe / unsubscribe のライフサイクルを `useEffect` で正しく管理(購読リーク厳禁)

#### Vertex AI TTS

- **モデル名は環境変数化**:`process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-tts'`(§3-4)
- GA から日が浅いため、Claude Code の training data カバレッジが薄い可能性
- 実装時は **公式ドキュメント URL を Claude Code に渡して `WebFetch` で参照させる**:
  - `https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini-tts`
- 認証は Vercel 環境変数のサービスアカウント鍵 + `google-auth-library`、Application Default Credentials は使わない(Vercel 環境では動かないことがある)
- 音声長 655秒制限・8000バイト制限への対策は §3-4 を実装時に必ず参照

#### Supabase Edge Functions

- Deno ランタイムであること、Node.js 固有 API(`fs`, `path` 等)が使えないことを明記
- npm 互換は `npm:` prefix で利用可、ただし重い依存は避ける
- 関数1個で全ポーリングを処理せず、**サイトごとに並列起動**(タイムアウト回避、§10-2)
- シークレットは `Deno.env.get()` で取得、ハードコード厳禁
- ローカル開発:`supabase functions serve --env-file .env.local`

#### 型と検証

- **`supabase gen types typescript` で生成した型は手動編集禁止**(コメントで明記)
- API 入出力は zod スキーマで定義、`z.infer<>` で型を導出
- DB から取得したデータは zod で再検証してから使う(RLS が外れた時の保険)
- フォーム入力も zod スキーマを使い、エラーメッセージは日本語

#### コーディング規約

- TypeScript strict mode、`any` 禁止(型不明な場合は `unknown` で受けて zod 検証)
- 関数名・変数名は英語、コメント・UI 文言は日本語
- ファイル命名:コンポーネントは PascalCase、それ以外は kebab-case
- ディレクトリ構成:
  - `src/app/`(Next.js App Router)
  - `src/components/`(UI コンポーネント)
  - `src/lib/`(ユーティリティ:`geo.ts`, `realtime.ts`, `supabase.ts` 等)
  - `src/schemas/`(zod スキーマ)
  - `src/prompts/`(LLM プロンプト)
  - `src/types/`(自動生成型 + 手動型)

#### 触ってはいけない場所

- `supabase/migrations/`:Claude Code は **migration を新規作成のみ可、既存 migration の編集禁止**(適用済みファイルを変えると整合性が壊れる)
- `src/types/database.types.ts`:自動生成、手書き禁止
- `.env*`:Claude Code から書き換え禁止(秘密情報の事故防止)

#### Plan Mode 運用ルール

- **新規機能着手前に Plan を出させる**(Claude Code の Plan Mode を使う)
- Plan には以下を含める:
  - 変更ファイル一覧
  - DB スキーマ変更の有無(あれば migration ファイル名)
  - 新規依存追加の有無(あれば理由)
  - テスト方針
- 翔太さんが Plan を承認してから実装に進む

#### コミット粒度

- 1機能=1コミット原則(Claude Code が一気に大量変更しがちなので意識的に区切る)
- コミットメッセージは日本語可、Conventional Commits 推奨(`feat:`, `fix:`, `refactor:` 等)

---

## 13. 推奨デバイス(車内クライアント)

### Lenovo Tab M11(変更なし、初版踏襲)

| 項目 | 仕様 |
|---|---|
| 画面 | 10.95型(1920×1200)90Hz |
| プロセッサー | MediaTek Helio G88 |
| メモリ / ストレージ | 4GB / 64GB |
| バッテリー | 約10時間 |
| 3.5mm ジャック | あり |
| USB-C | あり(充電専用) |
| 防滴防塵 | IP52 相当 |
| OS | Android 13 |
| 実売価格 | 約32,000〜38,000円 |

**推奨理由**:
- 3.5mm ジャックがある → 充電と音声入力が独立(USB-C ハブ不要)
- 必要十分な性能(Helio G88 は本システムの処理を快適にこなす)
- IP52 防滴防塵で車内利用に耐える
- コスト説明しやすい(iPad の半額)
- Google Play 対応 → Chrome がフル機能で動作

**他機種選定時の着眼点**(必須):3.5mm ジャック / Google Play 対応 / GPS 内蔵 / USB-C ポート
**(推奨)**:メモリ3GB 以上 / バッテリー7000mAh 以上 / IP52 以上 / 10インチ以上 / 実売3〜5万円以内

---

## 14. 車内運用オペレーション(MVP で電源 ON 自動起動を実装)

### 14-1. MVP 運用フロー(自動起動前提)

```
ドライバーが乗車
   ↓
エンジン ON or 電源ボタン長押しでタブレット起動
   ↓
(自動)Termux:Boot が Python ヘルパーを起動 → MQTT 接続待機
   ↓
(自動)MacroDroid が Chrome を起動し、車内クライアント URL を全画面で開く
   ↓
(自動)デバイストークン認証 → 番組選択画面
   ↓
ドライバーが番組をタップ(1タップ目)
   ↓
OK をタップ(2タップ目)→ 再生開始
```

**判断方針**:Android Enterprise / MDM(本番向けの管理基盤)は Phase 2 のままだが、**実証用途で十分な「電源 ON で自動起動」は MVP で実装する**。MacroDroid + Termux:Boot は本番のエンタープライズ運用には脆いが、実証フェーズでは「ドライバーが触るのは番組選択の2タップだけ」を実現するのに十分。

### 14-2. 自動起動の実装(MUST / MVP)

**A. Python ヘルパー(3.5mm 入力監視)の自動起動**:
- **Termux + Termux:Boot** をタブレットにインストール
- `~/.termux/boot/` に起動スクリプトを配置 → 電源 ON で自動実行
- 起動スクリプトは `python /path/to/audio_monitor.py` を呼ぶ
- スクリプトは MQTT 接続を維持し、3.5mm 入力レベルを監視
- 異常終了時の自動再起動は `while True` ループ + 例外ハンドリングで素朴に実装(systemd 相当は Termux にないので)

**B. ブラウザ(車内クライアント)の自動起動**:
- **MacroDroid**(無料、設定 GUI が分かりやすい)を採用
- トリガー:「デバイス起動完了」
- アクション:「Chrome を起動し、URL `https://app.example.com/client?bus=BUS_001` を開く」
- 全画面表示:Chrome の「ホームに追加」で PWA 化 → 全画面起動
- Tasker でも同等のことは可能だが、MacroDroid のほうが学習コストが低い

**C. 電源 ON 〜 自動起動完了までの所要時間**:
- 通常30〜60秒(Tab M11 で実機検証必要)
- ドライバーには「電源 ON 後1分待つ」と説明

### 14-3. 認識している脆弱性と運用カバー

MacroDroid + Termux:Boot 構成は本番のエンタープライズ運用には脆弱(Android OS アップデート、Lenovo の仕様変更で壊れる可能性)。これは実証フェーズで許容するが、以下を運用でカバー:

- **設定情報のドキュメント化**:タブレットセットアップ手順を Notion 等に残す(再構築できるように)
- **ヘルパー稼働確認 UI**:車内クライアント画面に「MQTT 接続中」のステータスを表示(§5-5)
- **手動フォールバック**:自動起動が失敗した場合は、ホーム画面の Chrome ショートカット 1タップで起動できるように設定

### 14-4. Phase 2 で実装(MVP では実装しない)

- **Android Enterprise / MDM 連携**(Scalefusion / Hexnode / Intune)
- **キオスクモード**(他アプリへの切り替え封鎖、設定変更禁止)
- **完全シャットダウンからの自動起動安定化**(機種依存の挙動を MDM で吸収)
- **タブレットの一括プロビジョニング**(複数台展開時)
- **シガーソケット給電のエンジン連動検証と、給電断時の挙動最適化**

**判断根拠**:本番展開で台数が増えたら MDM 経由で一気に解決する。実証 1台ではコストオーバー。

### 14-5. 給電方式(参考、Phase 2 で詰める)

- シガーソケット経由(USB-A/C 変換アダプタ)
- 車両 USB ポート経由
- いずれもエンジン連動 / 常時給電は車種依存、要確認

### 14-6. MVP 実機検証項目(導入時に1度だけ確認)

- [ ] Tab M11 で Termux:Boot による Python 自動起動が動作するか
- [ ] MacroDroid で電源 ON 時の Chrome 自動起動が安定するか
- [ ] スリープ復帰時の挙動(完全シャットダウンとの違い)
- [ ] 自動起動完了までの実測時間
- [ ] HiveMQ Cloud との MQTT 接続が車内 Wi-Fi/モバイル回線で安定するか

---

## 15. 正常フロー・復帰フロー(MVP 簡易版)

### 15-1. 正常フロー(MVP)

```
ドライバーが手動でタブレット電源 ON
   ↓
Chrome ブックマーク → 車内クライアント
   ↓
デバイストークン自動認証
   ↓
番組選択(1タップ)
   ↓
OK(2タップ)→ 再生開始
```

### 15-2. エラー時の復帰

| ケース | 対応 |
|---|---|
| 通信エラー / GPS 未受信 | ステータス表示、自動リトライ |
| 運行中の通信断 | キャッシュ済み5本で継続、復帰後自動補充 |
| タブレットフリーズ | 電源長押しで再起動 → 上記フローを再実行 |

---

## 16. 運用保守設計(Phase 2 以降)

### 16-1. ログ設計(Phase 2)

- カテゴリ:車内クライアント / 位置判定 / 通信状態 / 音声再生 / バッチ / 認証 / API エラー
- MVP では Vercel logs と Sentry で代替

### 16-2. 監視・アラート(Phase 2)

- 監視対象:バッチ失敗、外部 API エラーレート、ストレージ使用量、車内クライアント長時間ログ未送信
- MVP では Supabase ダッシュボードと手動確認

### 16-3. データ管理・メンテナンス(Phase 2)

- 音声ファイル削除ポリシー
- コンテンツの有効期限・自動アーカイブ
- DB 肥大化対策(ログテーブル定期パージ)
- バックアップ(Supabase Pro 移行時に自動有効化)

### 16-4. 障害対応フロー(Phase 2)

- 障害レベル定義(軽微 / 重大 / サービス停止)
- レベルごとの通知先・対応手順

### 16-5. 将来分析活用(MVP の運行記録系が基盤)

- どのコンテンツがどの区間で何回再生されたか(`trip_playback_events`)
- どの区間で GPS 精度が低下するか(`vehicle_location_logs`)
- どの時間帯・区間で通信断が多いか
- 乗客対話セッションの頻度・内容傾向(Phase 2 以降)

---

## 17. 未決定・本番化検討事項

| 項目 | 確認先 | 影響 |
|---|---|---|
| シガーソケット給電がエンジン連動か | バス車両仕様 | スリープ復帰設計 |
| Tab M11 自動起動の安定性 | 実機検証 | 運用フロー成立可否 |
| 一日の最長放置時間 | 運行オペレーション | バッテリー切れリスク |
| GTFS 静的データのカバレッジ(対象路線) | 自治体 | Phase 2 のデータソース |
| 外部音声入力の実信号 specifications | 車両仕様 | MQTT ヘルパー実装 |
| Office 系ファイル対応(Word / PPT / Excel) | プロダクト要件 | Phase 2 |
| Mapbox 移行検討 | デザイン要件 | スケール時 |
| 乗客対話セッション STT 対応 | プロダクト要件 | Phase 2 |
| オンデマンド型 近接判定範囲のデフォルト値 | 実証データ | Phase 2 |
| バスへの複数番組登録(時間帯切り替え) | プロダクト要件 | Phase 2 |

---

## 付録 A:設計原則のサマリ

1. **プロトと本番で同じアーキテクチャを使う**(Realtime と Edge Functions は最初から)
2. **クライアント側で完結できる処理は DB に持ち込まない**(位置判定、空間判定)
3. **永続フラグの代わりにイベント記録**(`trips` + `trip_playback_events`)
4. **将来の拡張カラムは最初から作る、テーブルは後から足す**
5. **モデル名・閾値は環境変数化**(差し替え時に書き換え1箇所)
6. **検証コストの低い順に実装**(MUST → SHOULD → COULD、WON'T は触らない)
7. **stable モデル / GA 機能を優先**(preview は実証用途では時期尚早)

## 付録 B:変更履歴

| 日付 | 変更内容 |
|---|---|
| 初版 | ドラフト作成 |
| 2026-05-01 | Claude との壁打ちを経て改訂(本仕様書):Realtime / Edge Functions / 距離計算 / trips / PostGIS 不採用 / TTS モデル / MVP スコープ / Pre-v0 TODO 追加、根拠章追加 |
| 2026-05-01 (rev2) | §0-3「意図的にオープンにする領域」追加、§12-4「Claude Code 実装ガードレール(`CLAUDE.md` 内容)」追加 |
| 2026-05-01 (rev3) | ①自動起動を MVP 化(MacroDroid + Termux:Boot、§14 全面書き換え、3.5mm ヘルパーも MVP 実装)、②TTS 長文分割を MVP から外し拡張余地のみ確保(§3-4)、③テキスト手入力を MUST 化(§3-1, §3-5)、§12-1-b に Tab M11 セットアップ TODO 追加 |
| 2026-05-01 (rev4) | DB 初期マイグレーション SQL ドラフト作成に伴う追記:§7-1-b「認証経路と RLS の設計」追加(サインアップ無効化、車内クライアントは Service Role 経由)、§8-1 に `metadata` / `settings` 使い分け規約追加、§12-1 に Auth セットアップ手順追加 |
