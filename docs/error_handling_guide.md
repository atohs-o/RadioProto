# 異常系ハンドリング網羅ガイド ― 一般原則からAutoDJ Radio向けレビューチェックリストまで

このレポートは、「ソフトウェア開発における異常系（エラー・エッジケース・failure modes）」を**多角的に網羅列挙**し、各層のハンドリングのベストプラクティスを整理した上で、**vibe coding（AIアシスタント主導の開発）に特有の盲点**を補い、最後に**車載タブレット向けGPS連動音声配信システム「AutoDJ Radio」**（Next.js/TypeScript/Supabase/Vertex AI/Leaflet/Androidタブレット）のコードレビューに即使えるチェックリストにまとめたものです。

---

## 1. 用語と理論的整理

### 1.1 Error / Exception / Fault / Failure / Defect

Laprie & Avižienisの古典的定義（ISO/IEC/IEEE 24765:2017、依存性研究の標準語彙）では以下のように区別される：

| 用語 | 定義 | 例 |
|---|---|---|
| **Error（誤り）** | 開発者の人間的ミス、あるいはシステム状態のうち将来failureを引き起こし得る検出可能な部分 | パス区切りを`\`にしてしまう、設計仕様の誤解 |
| **Fault（欠陥）** | コードや構成における不正な状態。bugやdefectとほぼ同義。errorによって注入される | NULLチェック漏れ、競合条件の存在 |
| **Failure（失敗）** | サービスが仕様から逸脱して提供される*出来事*。ユーザから観測される | 500エラー、画面が固まる、誤った音声を再生 |
| **Exception（例外）** | プログラミング言語機構として明示的に発生・伝播するfault検出シグナル | `TypeError`, `TimeoutException` |

重要なのは「**fault → error → failure**」という因果連鎖を意識すること。defensive programmingはfaultが伝播してfailureになる経路を遮断する営みである。

### 1.2 Fail-fast / Fail-safe / Fail-soft / Let it crash

| 戦略 | 内容 | 適合場面 |
|---|---|---|
| **Fail-fast** | 異常を検出したら即停止し上位へ伝播。腐ったデータが拡散する前に止める | 入力検証、契約違反、起動時の設定検査 |
| **Fail-safe** | 失敗しても安全な状態に遷移（核制御、自動車のブレーキ） | 安全クリティカル系 |
| **Fail-soft / Graceful degradation** | 機能を縮退して継続提供（地図が出なくても音声は流れる等） | ユーザ向けサービス |
| **Let it crash（Erlang/Joe Armstrong）** | エラーを過剰に防御せず、プロセスを潔く落としてsupervisorが再起動。「2つのプロセッサがなければfault-tolerantは作れない」 | アクターモデル、隔離可能なワーカー |

Armstrongの核心は「**正常系の薄いコードを書き、不確かなものを掴もうとしない（don't catch what you can't remedy）**」。`try/catch`の握りつぶしを避ける思想の源流。

### 1.3 Resilience patterns（Release It! Michael Nygardより）

Nygardは**12のstability anti-patterns**（Integration Points, Cascading Failures, Users, Blocked Threads, Self-Denial Attacks, Scaling Effects, Unbalanced Capacities, Dogpile, Force Multiplier, Slow Responses, Unbounded Result Sets, Chain Reactionsなど）と、対になる**stability patterns**を提示している：

- **Timeouts**：すべての外部呼び出しに必須。デフォルト無限は罪
- **Circuit Breaker**：closed → open → half-open。連続失敗で遮断、定期的試行で回復確認（Hystrix, resilience4jの中核）
- **Bulkhead**：船の隔壁のように障害を区画化。スレッドプール/コネクションプールを呼び先ごとに分離
- **Steady State**：人手介入なしに永続稼働。ログ・DB・キャッシュを定期パージ
- **Fail Fast**：捌けない要求は即断る（待たせない）
- **Handshaking**：受け手が「今は無理」と言える仕組み（back pressure）
- **Test Harness**：本番障害を模した低レベル故障注入
- **Decoupling Middleware**：時間/空間/型の分離（キュー、Pub/Sub）
- **Shed Load**：上限を超えたら捨てる
- **Back Pressure**：満杯を上流に伝える
- **Governor**：自動アクションに上限（リトライストーム抑制）

これに加えて、リトライは必ず**指数バックオフ＋full jitter**で（AWS Builders' Library推奨）。さもなくば「thundering herd」を生む。

---

## 2. 異常系の網羅的分類（複数軸で重複許容）

### 2.1 入力検証層
- 型不一致、範囲外、null/undefined/空文字、空配列
- 巨大入力（ZIP bomb、JSON爆弾、`{"a":{"a":{...}}}`の深いネスト）
- 文字エンコーディング（UTF-8不正シーケンス、BOM、CRLF/LF混在）
- Unicode正規化未統一（NFC vs NFD）、絵文字、サロゲートペア、結合文字、ZWSP/ZWNJ
- 右から左へのテキスト（RTL override攻撃）
- SQL/NoSQL/LDAP/コマンド/XPath/HTMLインジェクション、テンプレートインジェクション（SSTI）
- パス・トラバーサル（`../`, `..\`, URL encoded variants）
- 数値のオーバーフロー、`Infinity`/`NaN`、JS の`Number`精度（53bit）
- 浮動小数点比較（`0.1+0.2 !== 0.3`）、丸め誤差、ゼロ除算
- 巨大正規表現によるReDoS

### 2.2 認証・認可
- トークン期限切れ・前後ロール、リフレッシュレース、署名検証スキップ
- 権限境界（IDOR、horizontal/vertical privilege escalation：OWASP A01）
- セッション固定、CSRF、Cookie属性漏れ（SameSite/Secure/HttpOnly）
- 多要素認証バイパス、ブルートフォース、credential stuffing
- OAuthのstate/PKCE漏れ、open redirect

### 2.3 ネットワーク層
- 接続タイムアウト/読み取りタイムアウト/全体タイムアウト
- TCP RST、half-open connection、DNS失敗・TTLずれ
- TLSハンドシェイク失敗（証明書期限、SNI、中間CA欠落）
- partial response、chunked転送中断
- 帯域不足、パケットロス、jitter（音声品質劣化）
- IPv4/IPv6切替、NAT再バインド、車載WiFi/4G/5Gのハンドオフ
- Captive Portal、DNS Hijack、プロキシ介在

### 2.4 外部API・サードパーティ
- レート制限（429）、quota消費、リトライストーム
- API仕様変更・破壊的バージョン更新、未知フィールド、欠落フィールド
- 4xx（権限・入力）、5xx（一時的・恒久的）、サービス全停止
- レスポンス遅延（Slow Response）、応答スキーマ不一致、HTMLエラーページがJSONエンドポイントから返る
- 通信は成功したが意味的に失敗（200で`{"error":...}`）

### 2.5 データベース
- コネクションプール枯渇、prepared statementキャッシュ枯渇
- デッドロック、ロック待ちタイムアウト
- ユニーク制約違反、外部キー違反、NOT NULL違反、CHECK制約
- レプリケーション遅延（read-after-write inconsistency）
- トランザクション失敗、部分コミット、ネストトランザクション
- 楽観的ロック失敗（version mismatch）、ロストアップデート
- マイグレーション中の一時的schema不一致

### 2.6 並行性・並列性
- Race condition、Time-of-check-to-time-of-use（TOCTOU）
- Deadlock、Livelock、Starvation、Priority inversion
- ABA問題、lost update、phantom read
- イベントループブロッキング（Node.jsの同期I/O混入）
- 二重実行（ボタン連打、リトライ＋成功の二重課金）

### 2.7 状態管理・整合性
- 部分的失敗（分散トランザクションの一部のみ成功）
- べき等性欠如（同じ操作の重複実行で副作用）
- イベント順序逆転、out-of-order delivery
- eventually consistent system での読み書き競合
- キャッシュとDBの不一致、二重書き込み

### 2.8 ファイル・ストレージ
- ディスク満杯（特にログ無制限）、inode枯渇
- 権限なし、読み取り専用ファイルシステム
- ファイルロック競合、NFS/EFSのstale handle
- 部分書き込み、`fsync`未呼び出しでの停電消失
- ファイル名の文字制限（NTFS, FAT, exFAT, Android external storage）

### 2.9 メモリ・リソース
- OOM、メモリリーク、断片化
- ファイルディスクリプタ枯渇、ポート枯渇（TIME_WAIT滞留）
- スレッドプール/イベントループ枯渇
- 大量画像/音声デコーダによるネイティブヒープ膨張（Android）

### 2.10 時間・タイミング
- 時刻同期ずれ（NTP障害、車載で外部時計不在）
- タイムゾーン、夏時間、うるう秒、`Date`オブジェクトの暗黙ローカル変換
- Clock skew によるJWT署名検証失敗
- TTL切れ直前の同時再フェッチ（cache stampede）、スタンピード対策はrequest coalescing/early refresh
- スケジューラ遅延、cron重複実行

### 2.11 国際化・ローカライズ
- 多言語フォント未搭載、CJK改行、合字
- 単数複数規則（英語以外複雑）、性別、数値表記（小数点・桁区切り）
- 通貨と為替、住所形式（郵便番号の有無）

### 2.12 セキュリティ系（OWASP Top 10 2021）
1. **A01 Broken Access Control**（最多、94%のアプリで発見）
2. **A02 Cryptographic Failures**
3. **A03 Injection**（XSS含む）
4. **A04 Insecure Design**（新設）
5. **A05 Security Misconfiguration**（XXE含む）
6. **A06 Vulnerable and Outdated Components**
7. **A07 Identification and Authentication Failures**
8. **A08 Software and Data Integrity Failures**（CI/CD改ざん、署名なし更新）
9. **A09 Security Logging and Monitoring Failures**
10. **A10 Server-Side Request Forgery（SSRF）**

加えてLLM時代特有として OWASP Top 10 for LLM Applications（LLM01 Prompt Injection 等）。

### 2.13 LLM/AI特有
- **ハルシネーション**：実在しないAPI、捏造引用、誤った事実
- **直接/間接プロンプトインジェクション**：ユーザ入力やRAGコンテンツによる指示乗っ取り
- **Jailbreak**：安全機構迂回
- トークン制限超過、context window溢れ（古い指示の喪失）
- レート制限、quota枯渇、コスト暴走（無限ループの自己再帰）
- 出力JSONパース失敗、stop sequence漏れ、コードフェンス混入
- temperature由来の非決定性 → 同一入力に異なる出力
- 不適切出力（PII、暴言、競合社名）
- ツール呼び出しの誤実行（agent loopの暴走）、SSRF/RCE経路化
- 評価コストとレイテンシ（post-LLMガードレールは高い）
- モデルバージョン更新による回帰

### 2.14 IoT・モバイル・組み込み・車載
- **電源断**：イグニッションオフ、12V瞬断、サスペンド/レジューム
- 再起動ループ（init設定不良）、watchdog timeout
- OTAアップデート失敗、A/Bパーティション切替失敗
- フラッシュ書き込み摩耗（SDカード、eMMC）、低温起動、高温スロットリング
- 振動による接触不良、ディスプレイ輝度自動制御不能
- ネットワーク断続（トンネル、地下駐車場、山間部）
- **GPS信号ロスト/マルチパス**：高層建築・トンネル・SAバウンディングボックス、coldスタート時のTTFF
- センサー異常値（緯度0,0、速度1000km/h、jumping fix）、時刻のみ提供で位置なし
- バックグラウンド制限（Doze, App Standby）、画面OFFでJSタイマー停止
- Bluetoothオーディオ接続切断、SCO/A2DP遷移
- Androidタブレット特有：WebView版数差異、Chrome更新延期、自動回転

### 2.15 ユーザー操作系
- ボタン連打、ダブルサブミット、ゲーム的高速操作
- ブラウザ戻る/進む、リロード、タブ複数開き
- 通信オフラインで途中遷移、画面遷移中のAPI応答
- 拒否設定（位置情報、通知、カメラ、マイク、ストレージ）
- アクセシビリティ（スクリーンリーダ、コントラスト、フォントサイズ）

### 2.16 デプロイ・運用
- 互換性のないDBマイグレーション（ロールバック不可能なALTER）
- 環境変数欠落、シークレット漏洩（GitHub公開、ログ出力）
- 依存パッケージのCVE、サプライチェーン攻撃（OWASP A08）
- カナリア/ブルーグリーン失敗、ロールバック中の二重バージョン稼働
- フィーチャーフラグ取り違え

### 2.17 観測可能性の欠如
- ログレベル誤用、PIIをログに出してしまう
- メトリクス欠落（成功率は見ているが、p99レイテンシは見ていない）
- 分散トレーシング途切れ（context propagation欠落）
- エラー握りつぶし（`catch (e) {}`）、Sentry等への通知忘れ

---

## 3. ハンドリングのベストプラクティス

### 3.1 catchする位置と伝播
- 原則：**取り扱える層まで例外を上げ、その層で意味のある回復を行う**。途中でcatchして`console.log`して再throwしないのは反パターン。
- 境界（境界＝API/UI/ジョブの入口）に**Error Boundary**を一つ置き、そこで分類→ユーザ向け応答／ログ送信／メトリクス更新。
- Result型（`Result<T, E>` / Rust流）かtagged unionで「失敗が型に現れる」設計を選ぶとAI生成コードでも握りつぶしを検出しやすい。

### 3.2 ユーザーへの見せ方
- **何が起きたか／自分で何ができるか／いつ復旧するか**の3点を簡潔に
- スタックトレースを見せない（情報漏洩、OWASP A05）。`requestId`だけ提示して問い合わせ用に
- 復旧可能なら自動リトライ、リトライ中はskeleton/spinner、不可逆操作には確認ダイアログ
- 車載のような注視時間が短い文脈では「アイコン＋短文＋自動回復」が原則

### 3.3 ログ・モニタリング・アラート
- 構造化ログ（JSON）、相関ID、PIIマスキング、サンプリング
- **4 Golden Signals**（SRE）：Latency / Traffic / Errors / Saturation
- アラートはSLO違反を中心に。「pages per week」を抑える設計
- error budgetを定義し、消費が早いときはリリース凍結

### 3.4 自動復旧 vs 人手介入
- 自動復旧：transient、影響範囲が局所、副作用が可逆、観測可能
- 人手介入：データ破損の疑い、課金/法的影響、原因不明
- 自動化には**Governor**（上限付き）を必ず設ける

### 3.5 Graceful degradation
- 機能の依存グラフを書き、各依存が落ちた時の最低限のUXを定義
- AutoDJ Radioの例：
  - 地図APIダウン → 直近のGPS座標で疑似地図、または地図非表示
  - Vertex AIダウン → 事前録音のフォールバック音声、または無音＋次曲予告
  - Supabase Realtime切断 → ポーリングに自動降格

### 3.6 カオスエンジニアリング
- Netflix Chaos Monkey系。「故障は起きるのでわざと壊して耐性を測る」
- 本番に近い環境で：ネットワーク遅延注入、依存サービス停止、Pod kill
- まずGame Day（手動シナリオ）から、徐々に自動化

---

## 4. Vibe Coding / AI生成コード特有の論点

### 4.1 典型的な見落としパターン

Karpathy自身、2026年に「vibe codingの誤り種類は『構文ではなく微妙な概念ミス』」と認め、後に「**agentic engineering**」への呼称変更を提案。複数の現場報告で「vibe-coded PRには境界条件・エラー経路・例外論理が欠ける（AIが忘れたのではなく、人間が指示しなかったから）」と一貫して指摘されている。

| パターン | 具体例 |
|---|---|
| **Happy path偏重** | 「ユーザが正しい入力をした場合のみ動く」コードがしれっと出てくる |
| **try-catch握りつぶし** | `catch (e) { console.error(e) }`で終わり、上位は成功扱い |
| **`any`乱用、`!`乱用** | TypeScriptで型は通るが意味的にnull安全でない |
| **エラーメッセージのリーク** | 例外messageをそのままレスポンスに含める |
| **prompt injection無防備** | RAG文脈のテキストを信頼してsystem promptに混ぜる |
| **過度に楽観的リトライ** | 5xxを無条件・無バックオフでループ |
| **テストの偏り** | happy pathのみ、null/空配列/同時実行/巨大入力/失敗系が薄い |
| **認可ロジック脇の甘さ** | Supabase RLSを書かずクライアントSDKを直叩き、IDOR成立 |
| **クリーンな見た目で読みやすいが、不確実性のサインがない** | 人手コードに残る`// TODO`、防御チェック、コメントが消える |
| **依存追加の安易さ** | 不要な大型ライブラリ追加、CVE未確認 |
| **シークレットがクライアントに混入** | AIが`.env`を理解せず`NEXT_PUBLIC_`接頭辞のついた変数にAPIキーを入れる |

### 4.2 AIに異常系を考えさせる質問のフレーミング

人間レビュアーが意識すべき「補完視点」：
- 「**この関数が呼ばれる7つの異常シナリオを列挙して**」と件数を指定すると網羅性が上がる
- 「**この入力が敵対的なユーザから来たと仮定して脅威モデルを書け**」
- 「**この外部呼び出しが0ms / 30s / 200 OKでHTML本文 / 200 OKで空ボディ / 504 / TLSエラー の各ケースで何が起きるか**」
- 「**この処理を100回並列実行した場合の不変条件は？**」
- 「**ロールバックできない副作用は？** リトライ可能性を分類して」
- 「**観測性：このコードが本番で壊れた時、ログだけで原因特定できる？**」

### 4.3 AIコードの安全網

- **TypeScriptの厳格化**：`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **静的解析**：ESLint（`no-floating-promises`, `no-unsafe-*`）, Biome, Semgrep, CodeQL
- **契約プログラミング**：Zod/Valibot/io-ts による境界バリデーション
- **Property-based testing**（fast-check）：境界・null・巨大値を自動生成
- **Mutation testing**（Stryker）：テストが本当に異常系を捉えているか検査
- **SAST/DAST/SCA**：Snyk, Dependabot, ZeroPath
- **AIレビュアー二段重ね**：別モデル（または別プロンプト）で「異常系の欠落」だけを指摘させる
- **CLAUDE.md / GEMINI.md / Cursor Rules**：「全外部呼び出しにtimeout」「catchで握りつぶし禁止」等の規約を恒久メモリに

---

## 5. AutoDJ Radio コードレビュー用チェックリスト

以下、層別にactionableな項目で。各項目は「Yes/No/N/A」で判定可能なように書いてある。

### 5.1 入力検証
- [ ] 全APIエンドポイントの入力をZod（または同等）でスキーマ検証している
- [ ] 緯度経度の範囲（lat: -90..90, lng: -180..180）を必ず検証している
- [ ] GPS座標が`(0,0)`（Null Island）と一致した場合は無効値として扱っている
- [ ] 速度・高度・accuracy値の異常値（負数、巨大値）をフィルタしている
- [ ] 文字列入力の最大長を全て上限設定している（タイトル、住所、検索クエリ等）
- [ ] Unicode正規化（NFC）を境界で統一している
- [ ] ファイル名・パス入力でパストラバーサル防御をしている

### 5.2 認証・認可（OWASP A01対策）
- [ ] Supabase Row Level Security（RLS）を全テーブルで有効化している
- [ ] anon keyで触れるテーブル/カラムを精査済み
- [ ] service_role keyはサーバ側（Edge Function / Next.js API Route）にのみ存在し、`NEXT_PUBLIC_`に混入していない
- [ ] JWT検証で`exp`/`iat`/`aud`を確認、clock skew許容を妥当な範囲に
- [ ] 認可は**サーバ側で**毎リクエスト確認している（UI非表示だけでなく）
- [ ] ユーザID は URL/パラメータでなく認証済みセッションから取得している（IDOR防止）

### 5.3 ネットワーク・タイムアウト
- [ ] **全fetch/外部呼び出しにtimeout（AbortControllerで）**が設定されている
- [ ] timeoutは「接続」「読み取り」「全体」で個別に意識している
- [ ] リトライは指数バックオフ＋full jitter、最大試行回数あり
- [ ] リトライ対象を絞っている（5xx/ネットワーク誤りのみ。4xxは原則しない）
- [ ] 非idempotent操作のリトライにはidempotency keyを使っている
- [ ] Circuit breaker（または相当のkill switch）を地図API・Vertex AI・楽曲CDNに用意
- [ ] オフライン状態を検知し、UIで明示（車載で重要）

### 5.4 外部API（Vertex AI、地図、Supabase）
- [ ] Vertex AIレスポンスのJSONパース失敗時にcrashせずfallbackする
- [ ] LLM出力のスキーマ検証（Zod）を実施。失敗時は再生成 or fallback
- [ ] トークン数の事前見積もりとcontext window超過の事前検査
- [ ] **コスト上限**：日次/時間別のクォータと回路遮断
- [ ] LLM応答の不適切語フィルタ（PII、競合企業名、運転妨害となる長文）
- [ ] **prompt injection対策**：ユーザ入力やジオコーディング結果テキストをsystem promptから明確に分離（タグ・delimiter＋instruction hierarchy）
- [ ] LLM呼び出しごとに`requestId`を発行しトレース可能に
- [ ] 地図タイルAPI（Leaflet）のレート制限に達した時のフォールバック（ローカルキャッシュ／低解像度／非表示）
- [ ] Supabase Realtime切断時の自動再接続＋ポーリング降格

### 5.5 データベース・整合性
- [ ] ユニーク制約違反を捕捉して「既に存在」ではなく適切なエラーとして返す
- [ ] トランザクション内で外部API呼び出しをしていない（長期ロック回避）
- [ ] 楽観的ロックの衝突を再試行 or ユーザ通知の方針が明確
- [ ] マイグレーションは前方互換（add column → backfill → switch read → drop column）
- [ ] 重複作成防止のidempotency keyをジョブテーブルに保持

### 5.6 並行性・状態
- [ ] 楽曲再生キューの状態遷移は単一source of truthでstateマシン化
- [ ] 再生中の二重トリガ（連打、Realtimeイベント＋ローカル更新）防止
- [ ] React側の`useEffect`に依存配列の取りこぼしがない（stale closure）
- [ ] AbortControllerで前回リクエストをキャンセル（GPS位置更新時の検索リクエスト）
- [ ] 端末スリープ復帰後の状態同期ロジック

### 5.7 時間・タイミング
- [ ] サーバ／クライアント時刻のずれを前提に設計（UTC＋ISO 8601で扱う）
- [ ] タイムゾーンを暗黙のローカルにせず明示
- [ ] cache stampede対策（SWR/React Query の dedupe、Edge cache のstale-while-revalidate）
- [ ] cron/スケジュールジョブは重複実行に耐える

### 5.8 セキュリティ（OWASP A01–A10）
- [ ] レスポンスにスタックトレースを返していない
- [ ] CSPヘッダ、`Strict-Transport-Security`、`X-Content-Type-Options`設定
- [ ] CSRF対策（Next.js Route Handlerでstate-changing操作にトークン）
- [ ] アップロード・外部URL取得でSSRF防御（許可リスト、内部IPブロック）
- [ ] 依存ライブラリのCVEを週次チェック（Dependabot等）
- [ ] シークレットはGit履歴に存在しない（gitleaks）
- [ ] ログにJWT、メール、位置履歴のPIIが入っていない

### 5.9 GPS・位置情報・車載特有
- [ ] GPS精度（accuracy）が閾値以上の点は捨てる、または信頼度を下げる
- [ ] 位置のジャンプ（前回から1秒で数km移動）を検出し平滑化／除外
- [ ] GPSロスト時にDR（推測航法）または直近fixの保持＋表示ラベル「最後の位置」
- [ ] トンネル・地下駐車場想定のオフライン地図キャッシュ
- [ ] 位置取得permission拒否時のフロー
- [ ] 高頻度ポーリングによるバッテリ・データ消費の上限設定
- [ ] 車載のスリープ／レジューム／ホットリブートでWebViewが状態復元できる
- [ ] イグニッションOFF時の安全な状態保存（localStorage/IndexedDB write atomicity）
- [ ] 振動・直射日光・低温/高温下でのCPU/GPUスロットリング想定の負荷上限
- [ ] Bluetoothオーディオ切断時の自動再接続と無音検出
- [ ] 画面OFF/バックグラウンドでもタイマー精度が必要な箇所はService Worker / Foreground Service
- [ ] 運転中のUIは大きな要素・短文・自動消去（注視時間制約）

### 5.10 ユーザー操作・UI
- [ ] 主要ボタンに連打防止（debounce or disable on pending）
- [ ] ネットワーク中の遷移キャンセル時に副作用を残さない
- [ ] エラー画面に「再試行」「ホームに戻る」「問い合わせID」を提示
- [ ] React Error Boundary がページ単位で動作する
- [ ] 画面遷移中の未完了fetchをabortしている

### 5.11 ログ・観測性
- [ ] 構造化ログ＋requestId（クライアント→サーバ→Vertex AI→Supabase全レイヤで伝播）
- [ ] Sentry（または同等）にフロント・APIの未捕捉例外が送られる
- [ ] LLM呼び出しごとにinput/output/latency/cost/モデルバージョンを記録
- [ ] 4 Golden Signals のダッシュボード（latency p50/p95/p99、エラー率、QPS、メモリ）
- [ ] GPSロスト、Realtime切断、Vertex AIフォールバック発火率をメトリクス化
- [ ] SLO定義（例：再生開始成功率 99.5%、起動から最初の音声まで 5s p95）

### 5.12 デプロイ・運用
- [ ] フィーチャーフラグで新音声生成パスを段階展開
- [ ] DBマイグレーションは expand → migrate → contract の3段
- [ ] ロールバック手順書を月1で更新確認
- [ ] 設定値（quotaなど）の本番/開発の差異が明示されている
- [ ] OTAアップデート時にWebViewキャッシュをversionedにする
- [ ] 重大障害時のkill switch（音声生成停止／全車一斉メッセージ）

### 5.13 LLM固有
- [ ] Pre-LLMガードレール（PII検出、prompt injection検出、不適切入力）
- [ ] Post-LLMガードレール（grounding、不適切出力、運転妨害となる長文／パニック誘発表現）
- [ ] 自己修復ループ（出力が失敗時に1回だけ再生成）
- [ ] system prompt漏洩防御（出力にsystem prompt断片が含まれていないか）
- [ ] LLM出力がツール呼び出しを生成する場合のホワイトリスト
- [ ] モデルバージョンを固定し、回帰testを更新時に実行
- [ ] context windowに収まらない長い履歴の要約・truncate戦略

### 5.14 vibe codingレビュー特化
- [ ] `catch (e) {}` あるいは `catch (e) { console.log(e) }` で終わるブロックはゼロ
- [ ] `any`、`as`キャスト、非null assertion `!` の用途が説明可能か
- [ ] AIが追加した依存ライブラリの必要性とCVE状態を確認した
- [ ] テストファイルが happy path しかない関数はない
- [ ] AIに「この関数の異常系を10個挙げて」と聞いた結果を実装に反映した
- [ ] AIに `// TODO` や `// FIXME` を残させ、人間が後追いした
- [ ] git diff を全行読まずにマージしていない（特にmigration、認可、シークレット周辺）

---

## 6. まとめ（メタな指針）

1. **異常系は「列挙」より「分類軸」で洗う**。本レポートでは層×観点×OWASP×LLM×IoTで重複させて挙げた。重複は害ではなく、漏れの保険である。
2. **fail-fast＋let it crashとgraceful degradationは矛盾しない**。前者はモジュール内、後者はシステム全体の話。AutoDJ Radioでは「個々のリクエストはfail-fast、全体としては音が止まらないgraceful degradation」を目指す。
3. **vibe codingで最も削られるのは"unhappy path"**。Karpathyが認めた通り、誤りは「構文」ではなく「概念」。レビュアーは構文ではなく**前提と境界**を見る。
4. **コードを読まないなら、規約・型・テスト・観測でガードする**。CLAUDE.mdの規約、`strict`型、Zod境界、property-based test、Sentry通知、SLOアラート ― この5層が「人間がコードを完全理解しない時代」の安全網。
5. **車載コンテキストでは「失敗してもよい操作」を明確に**。地図が出ないのは許容、音が突然爆音になるのは許容不能、運転中の警告ダイアログは安全リスク。**failure modeに優先順位**をつけ、graceful degradation のシナリオを書き出すことが、レビューチェックリスト以上に重要な設計成果物となる。

このチェックリストを最低でもPR単位で機械的に通し、四半期に一度は Game Day（GPSロスト、Vertex AI停止、Supabase Realtime切断などをわざと発生させる）でカオスエンジニアリングを実施することを推奨する。