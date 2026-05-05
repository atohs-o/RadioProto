# AutoDJ Radio - v0 向け UI 仕様書

## これを渡す意図

このドキュメントはv0でUIプロトタイプを生成するための仕様書。
バックエンド・DB・認証の実装はClaude Codeが担当するため、**v0はデータ取得部分をスタブにして、UIとレイアウトに集中**してください。

---

## スタック

- Next.js 15（App Router）
- TypeScript（strict）
- Tailwind CSS
- shadcn/ui
- Leaflet + React Leaflet（地図）

---

## スタブの作り方（必ず守ること）

データ取得・更新はすべてスタブ関数で表現してください。

```typescript
// ✅ こう書く
async function getContents(): Promise<Content[]> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_CONTENTS
}

// ❌ こう書かない
const { data } = await supabase.from('audio_contents').select('*')
const res = await fetch('/api/contents')
```

型定義もスタブで書いてください。後でClaude Codeが `src/types/database.types.ts` に合わせて差し替えます。

---

## 画面一覧

### 管理画面（ルートユーザー向け）

1. **コンテンツ一覧**（`/contents`）
2. **コンテンツ編集**（`/contents/[id]`）
3. **ラジオ番組一覧**（`/programs`）
4. **ラジオ番組編集**（`/programs/[id]`）
5. **ポーリングサイト管理**（`/polling-sites`）

### 車内クライアント（タブレット向け）

6. **番組選択**（`/client`）
7. **番組確認・開始**（`/client/confirm`）
8. **再生モード**（`/client/play`）

---

## 各画面の要件

---

### 1. コンテンツ一覧（`/contents`）

**表示する情報**（カードまたはテーブル形式）:
- タイトル
- 概要（短縮表示）
- 作成日
- 最終更新日
- ソース分類タグ（`polling` / `manual` / `url`）
- 内容分類タグ（自由テキスト）
- 音声化ステータス（`未生成` / `生成済み` / `生成中` / `エラー`）
- ラジオ登録ステータス（`未登録` / `登録済み`）

**操作**:
- キーワード検索
- ソース・ステータスでの絞り込み
- 「新規作成」ボタン → コンテンツ編集画面へ
- 行クリック or 編集ボタン → コンテンツ編集画面へ
- 削除ボタン（確認ダイアログあり）

**スタブデータの例**:
```typescript
const MOCK_CONTENTS: Content[] = [
  {
    id: '1',
    title: '安曇野わさび農場 秋の収穫祭',
    summary: '10月15日〜17日に開催。入場無料、わさびソフト販売あり。',
    sourceType: 'polling',
    tags: ['観光', 'イベント'],
    audioStatus: 'generated',
    radioRegistered: true,
    createdAt: '2026-05-01',
    updatedAt: '2026-05-01',
  },
  {
    id: '2',
    title: '穂高神社 例大祭のお知らせ',
    summary: '9月26日〜27日。交通規制あり、穂高駅周辺は迂回推奨。',
    sourceType: 'manual',
    tags: ['観光', '祭り'],
    audioStatus: 'pending',
    radioRegistered: false,
    createdAt: '2026-05-02',
    updatedAt: '2026-05-02',
  },
]
```

---

### 2. コンテンツ編集（`/contents/[id]`）

**フォームフィールド**:
- タイトル（テキスト入力）
- 元テキスト入力エリア（大きめのテキストエリア、手入力 or ポーリング結果）
- 「AI で台本化」ボタン → ローディング → 台本テキストに結果が反映される
- 台本テキストエリア（編集可能、バイト数カウンター付き、上限4000バイト）
- 内容分類タグ（自由テキスト入力）
- 保存ボタン

**音声セクション**:
- 音声化ステータス表示
- 「音声を生成」ボタン → ローディング表示
- 音声プレビュープレイヤー（生成済みの場合）
- 「音声を再生成」ボタン（生成済みの場合）

**スタブ関数**:
```typescript
async function generateScript(text: string): Promise<string> {
  // TODO: Gemini API呼び出しをClaude Codeが実装
  return '【スタブ】生成された台本がここに入ります。'
}

async function generateAudio(scriptText: string): Promise<string> {
  // TODO: Vertex AI TTS呼び出しをClaude Codeが実装
  return '/mock-audio.mp3'
}
```

---

### 3. ラジオ番組一覧（`/programs`）

**表示する情報**:
- 番組名
- 登録コンテンツ数
- 有効 / 無効ステータス
- 最終更新日

**操作**:
- 「新規作成」ボタン
- 行クリック → 番組編集画面へ
- 有効 / 無効トグル
- 削除ボタン（確認ダイアログあり）

---

### 4. ラジオ番組編集（`/programs/[id]`）

**左ペイン: 地図（Leaflet + OSM）**:
- 路線ラインをポリラインで表示
- コンテンツ配置済みのピンをマーカーで表示（色分け: 登録済み=青、選択中=赤）
- 地図クリック → 新規ピン追加

**右ペイン: 設定パネル**:
- 番組名入力
- 有効 / 無効トグル
- 路線データ登録（CSVインポートボタン）
- 紐付けセット一覧（位置名称 / コンテンツタイトル / 音声長）
  - 各行に削除ボタン
- 保存ボタン

**Leaflet注意事項**:
- `dynamic(() => import(...), { ssr: false })` でSSR無効化すること
- 地図コンポーネントは `src/components/Map.tsx` として分離

**スタブデータの例**:
```typescript
const MOCK_PROGRAM = {
  id: '1',
  name: '安曇野北部ルート',
  enabled: true,
  routePoints: [
    { lat: 36.3006, lng: 137.8729 }, // 穂高駅
    { lat: 36.3234, lng: 137.8821 }, // 大王わさび農場
  ],
  items: [
    {
      id: '1',
      position: { lat: 36.3006, lng: 137.8729 },
      locationName: '穂高駅前',
      contentTitle: '安曇野わさび農場 秋の収穫祭',
      audioDuration: 95,
    },
  ],
}
```

---

### 5. ポーリングサイト管理（`/polling-sites`）

**表示する情報**（テーブル形式）:
- サイト名
- URL
- 有効 / 無効
- 最終取得日時
- 最終取得ステータス（`成功` / `失敗` / `未実行`）

**操作**:
- 「追加」ボタン → URL・サイト名入力モーダル
- 有効 / 無効トグル
- 削除ボタン

---

### 6. 番組選択（`/client`）

**タブレット向け大きめUI**:
- 利用可能な番組の一覧をカードで表示
- 番組名・登録コンテンツ数を表示
- カードタップ → 番組確認画面へ

**注意**: MVPでは番組が1つのみの想定なので、自動選択してそのまま次画面に進む設計でも可。

---

### 7. 番組確認・開始（`/client/confirm`）

**表示する情報**:
- 番組名
- 登録コンテンツ一覧（位置名称 / タイトル）
- GPS受信状況インジケーター（受信中 / 未受信 / 精度低下）
- サーバー通信状況インジケーター（接続中 / 切断）

**操作**:
- 「再生開始」ボタン（GPS・通信ともに正常の場合のみ有効）
- ステータスが異常の場合は警告表示

---

### 8. 再生モード（`/client/play`）

**タブレット常時表示画面。シンプルで視認性高く。**

**地図エリア（画面の大部分）**:
- Leaflet + OSM
- 現在位置をリアルタイム表示（青い丸マーカー）
- 路線ラインをポリラインで表示
- 再生位置ピン（色分け: 再生済み=グレー / 待機中=青 / 再生中=緑）

**ステータスバー（地図の上または下に固定）**:

| 項目 | 表示内容 |
|---|---|
| GPS | 受信中 / 未受信 / 精度低下 |
| サーバー通信 | 接続中 / 切断 |
| 現在再生 | コンテンツ名・残り時間 |
| キュー | 待機中コンテンツ数 |
| 外部音声入力 | ON / OFF トグル（MVPはダミー） |

**スタブ状態**:
```typescript
// GPS位置はブラウザのGeolocation APIをそのまま使う（スタブ不要）
// 再生状態はローカルstateで管理
const [playbackState, setPlaybackState] = useState<{
  currentContent: string | null
  queue: string[]
  gpsStatus: 'active' | 'inactive' | 'low-accuracy'
  serverStatus: 'connected' | 'disconnected'
  externalAudio: boolean
}>({
  currentContent: null,
  queue: [],
  gpsStatus: 'active',
  serverStatus: 'connected',
  externalAudio: false,
})
```

---

## UIのトーン・デザイン方針

- 管理画面: シンプルで情報密度高め、業務ツールらしい清潔感
- 車内クライアント: 大きめのフォント・タップターゲット、タブレット横持ち想定、暗い車内でも見やすいコントラスト
- エラー・警告の色: shadcn/ui の `destructive` / `warning` バリアントに準拠
- 日本語UIテキストで

---

## v0に渡す際の追加指示文（コピペ用）

```
以下の仕様書に基づいてUIを作成してください。

【重要なルール】
- データ取得・更新はすべてスタブ関数で実装してください（Supabase・fetch・axiosは使わない）
- 型定義はスタブで書いてください（後でClaude Codeが差し替えます）
- Leafletを使う場合は必ず dynamic(() => import(...), { ssr: false }) でSSR無効化してください
- shadcn/uiのコンポーネントを積極的に使ってください

（以下に仕様書の内容を貼る）
```
