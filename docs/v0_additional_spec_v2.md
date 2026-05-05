# AutoDJ Radio - v0 追加UI仕様書 完全版

F・G・H + I・J・K・Lの全ステップ。クレジット残量を見ながら上から順に進める。

---

## 共通ルール（全Step共通）

- データ取得はスタブ関数、fetch / supabase-js は書かない
- TypeScript strict、any / @ts-ignore 禁止
- shadcn/ui を積極的に使う
- UIテキストは日本語
- Sourcesの globals.css のブランドカラーを使う（`--brand-orange` 等）

---

## Step F: Empty / Error / Loading コンポーネント

**対象Project**: autodj_radio_admin / New Chat

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / Lucide React / src/ 構成

# 作るもの

## 1. src/components/common/empty-state.tsx

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

デザイン:
- 縦方向中央寄せ、py-16
- アイコン: w-12 h-12, text-muted-foreground
- title: text-lg font-semibold
- description: text-sm text-muted-foreground, mt-1
- actionボタン: mt-4, Primary

## 2. src/components/common/error-state.tsx

type ErrorStateProps = {
  title?: string        // デフォルト「エラーが発生しました」
  description?: string
  retry?: () => void
  className?: string
}

デザイン:
- EmptyStateと同構造
- アイコン: AlertCircle, text-destructive
- retryボタン: variant="outline", mt-4

## 3. src/components/common/loading-state.tsx

type LoadingStateProps = {
  message?: string      // デフォルト「読み込み中...」
  className?: string
}

デザイン:
- Loaderアイコンをanimate-spinで回転
- text-muted-foreground, 中央寄せ, py-16

## 使用例
app/(admin)/contents/page.tsx のモックデータを空配列にして、
EmptyStateが表示されることを確認できるよう更新する。
icon=FileTextIcon, title="コンテンツがありません",
action={ label: "新規作成", onClick: () => router.push('/contents/new') }

# TypeScript ルール・非要件（fetch・supabase・Server Actions不要）
```

---

## Step G: StatusIndicator（車内クライアント）

**対象Project**: autodj_radio_client / New Chat

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / src/ 構成

# ターゲット
タブレット横向き常時表示。暗めのカラースキーム。フォント最小18px。

# 作るもの

## 1. src/components/client/status-indicator.tsx

type StatusIndicatorProps = {
  status: 'ok' | 'warning' | 'error'
  label: string
  sublabel?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

デザイン:
- 横並び(flex items-center gap-2)
- 左: 丸いドット w-3 h-3
  ok=#4D9B6F / warning=#E8A838 / error=#D86A6A
- okの時のみ animate-pulse
- 右: labelはwhite、font-medium、sublabelはtext-muted-foreground、text-sm
- size='lg': ドットw-4 h-4、テキスト大きく

## 2. app/(client)/client/play/page.tsx のステータスバーを更新
StatusIndicatorコンポーネントに差し替える。
- GPS: active=ok / low-accuracy=warning / inactive=error
- サーバー: connected=ok / disconnected=error
- size='lg'で表示

# TypeScript ルール・非要件（fetch・supabase・Server Actions不要）
```

---

## Step H: モバイル対応（管理画面）

**対象Project**: autodj_radio_admin / New Chat

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / src/ 構成

# 作るもの

## 1. app/(admin)/contents/page.tsx
- md以上: 既存Tableをそのまま維持
- md未満: Cardで表示
  - Card内: タイトル(font-semibold) / ソースタグ(Badge) / 音声ステータス(Badge) / 操作ボタン
  - className="md:hidden" でカード一覧、className="hidden md:block" でテーブル

## 2. app/(admin)/programs/page.tsx
- 同様にmd未満でCard表示
  - Card内: 番組名 / コンテンツ数 / 有効/無効(Switch) / 編集Button

## 3. app/(admin)/layout.tsx
- モバイル時にSidebarがSheet(ドロワー)として開閉できることを確認・修正
- SidebarTriggerボタンがモバイルで視認しやすいサイズか確認

# TypeScript ルール・非要件（fetch・supabase・Server Actions不要）
```

---

## Step I: 認証・エラーページ群

**対象Project**: autodj_radio_admin / New Chat

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / Lucide React / src/ 構成

# 作るもの（7画面）

## 1. app/(auth)/layout.tsx — 認証レイアウト
Sidebar不要、画面中央寄せのシンプルなレイアウト。

## 2. app/(auth)/login/page.tsx — ログイン画面
- 中央カード配置（max-w-sm）
- ロゴ/プロダクト名「AutoDJ Radio」をカード上部に表示
- ブランドカラー（--brand-orange）をアクセントに
- メールアドレス入力（Input + Label）
- パスワード入力（type="password" + 表示/非表示トグル）
- 「ログイン」Button（Primary、w-full）
- 「パスワードを忘れた方」リンク → /reset-password
- URLパラメータ ?error= があればエラーメッセージ表示

## 3. app/(auth)/reset-password/page.tsx — パスワードリセット申請
- メールアドレス入力 + 「リセットメールを送信」Button
- 送信完了後は完了メッセージに切り替わる（useState）
- ← ログインに戻るリンク

## 4. app/(auth)/reset-password/confirm/page.tsx — パスワード再設定
- 新パスワード入力
- パスワード確認入力
- 「パスワードを更新」Button
- 成功後は完了メッセージ + ログインへのリンク

## 5. app/not-found.tsx — 404ページ
- 「404 - ページが見つかりません」
- SearchX アイコン（大きめ）
- 「管理画面に戻る」Button → /contents
- 中央配置

## 6. app/error.tsx — 500ページ（Next.js Error Boundary）
- 'use client' 必須
- props: { error: Error; reset: () => void }
- 「エラーが発生しました」+ AlertTriangle アイコン
- 「再試行」Button（reset()を呼ぶ）
- 「管理画面に戻る」リンク

## 7. app/loading.tsx — ルートローディング
- 画面全体中央にローディングスピナー（Loaderアイコン animate-spin）

## 8. app/(client)/client/setup/page.tsx — デバイス未登録画面
- タブレット向け大きめUI（フォント最小18px）
- 「このデバイスは未登録です」+ Tablet アイコン（大きめ）
- 「管理者にデバイスの登録を依頼してください」案内テキスト

# TypeScript ルール・非要件（認証ロジック不要、スタブのみ）
```

---

## Step J: 共通UIパターン・管理画面強化

**対象Project**: autodj_radio_admin / New Chat

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / Lucide React / src/ 構成

# 作るもの

## 1. src/components/common/confirm-dialog.tsx

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string      // デフォルト「削除」
  cancelLabel?: string       // デフォルト「キャンセル」
  onConfirm: () => void
  variant?: 'destructive' | 'default'
  isLoading?: boolean
}

デザイン:
- shadcn AlertDialog を使う
- variant='destructive': confirmボタンをdestructiveスタイル
- isLoading=true: confirmボタンをdisabled + Loaderスピナー

## 2. src/components/common/page-header.tsx

type PageHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
}

デザイン:
- flex justify-between items-start
- title: text-2xl font-bold
- description: text-muted-foreground, text-sm, mt-1
- action: 右端

## 3. src/components/common/data-pagination.tsx

type DataPaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

デザイン:
- shadcn Pagination コンポーネントを使う
- 前へ/次へ + ページ番号
- 現在ページをhighlight

## 4. src/components/admin/user-dropdown.tsx

type UserDropdownProps = {
  email: string
  displayName?: string
}

デザイン:
- Avatar + 名前/メール のボタン
- DropdownMenu: 「設定」→ /settings、「ログアウト」（スタブ）
- 既存のHeaderコンポーネントに組み込む

## 5. app/(admin)/contents/[id]/page.tsx — 音声生成モーダル追加
「音声を生成」Buttonクリック時にProgressダイアログを表示:
- shadcn Dialog
- 「音声を生成中です...」+ Progress バー（アニメーション）
- キャンセルボタン
- 完了後はダイアログが自動で閉じてステータスが更新（スタブ）

## 6. src/components/admin/csv-import-modal.tsx

type CsvImportModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (data: unknown[]) => void
}

3ステップUI:
- Step 1: ファイル選択（ドラッグ&ドロップ or クリック、.csvのみ）
- Step 2: プレビュー（テーブルで最大5行表示）
- Step 3: 確定（「インポート」Button + キャンセル）
- 各ステップにステップインジケーター表示

# TypeScript ルール・非要件（fetch・supabase・Server Actions不要）
```

---

## Step K: 車内クライアント強化

**対象Project**: autodj_radio_client / New Chat

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / Lucide React / src/ 構成

# ターゲット
タブレット横向き常時表示。暗めカラースキーム。フォント最小18px。タッチターゲット44px以上。

# 作るもの

## 1. src/components/client/offline-banner.tsx

type OfflineBannerProps = {
  visible: boolean
  onDismiss?: () => void
}

デザイン:
- fixed top-0 left-0 right-0
- 背景: #D86A6A（--brand-red）、テキスト: white
- 「サーバーとの接続が切断されました」+ WifiOff アイコン
- dismissボタン（X）を右端に
- visible=false で非表示（transition付き）

## 2. src/components/client/playback-error-dialog.tsx

type PlaybackErrorDialogProps = {
  open: boolean
  contentTitle?: string
  onSkip: () => void
  onRetry: () => void
}

デザイン:
- shadcn Dialog、タブレット向け大きめ文字（text-xl以上）
- 「{contentTitle}の再生に失敗しました」+ AlertCircle アイコン
- 「スキップ」Button（variant="outline"）+ 「再試行」Button（Primary）
- 2ボタンを横並びで大きく（min-h-[44px]）

## 3. src/components/client/end-trip-dialog.tsx

type EndTripDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

デザイン:
- shadcn AlertDialog、タブレット向け
- 「本日の運行を終了しますか？」
- 「終了する」Button（destructive）+ 「続ける」Button

## 4. app/(client)/client/play/page.tsx に以下を追加
- OfflineBannerをserverStatus='disconnected'の時に表示
- EndTripDialogを「運行終了」ボタンで開く
- 「運行終了」ボタンをステータスバーに追加（右端、variant="outline"、destructive色）

# TypeScript ルール・非要件（fetch・supabase・Server Actions不要）
```

---

## Step L: 設定・管理系画面

**対象Project**: autodj_radio_admin / New Chat

```
# Stack
Next.js 15 App Router / TypeScript strict / Tailwind / shadcn/ui / Lucide React / src/ 構成

# 作るもの

## 1. app/(admin)/settings/page.tsx — 設定画面

shadcn Tabsで3タブ構成:

Tab「プロフィール」:
- 表示名入力（Input）
- メールアドレス（読み取り専用）
- 「保存」Button

Tab「パスワード変更」:
- 現在のパスワード
- 新しいパスワード
- パスワード確認
- 「変更」Button

Tab「データ管理」:（Phase 2プレースホルダー）
- 「音声ファイルキャッシュをクリア」Button（variant="outline"）
- 「再生ログをエクスポート」Button（variant="outline"）
- クリックで「この機能は準備中です」トースト表示

## 2. app/(admin)/buses/page.tsx — バス管理

テーブル:
- バスコード / バス名 / デバイストークン（マスク表示 ****xxxx）/ 最終接続日時 / 操作

操作:
- 「トークンを表示」→ Dialogでフルトークン表示
- 「無効化」→ ConfirmDialog（Step Jで作ったもの）

右上「バスを追加」Button → Dialogでバスコード・バス名入力（スタブ）

## 3. app/(admin)/logs/page.tsx — 再生ログ一覧

レイアウト: md以上で左40%/右60%分割、md未満で上下積み

左: trip一覧テーブル（バスコード / 運行開始 / 運行終了 / 再生数）
右: 選択したtripの再生イベント一覧（コンテンツタイトル / ステータスBadge / 再生時刻）

フィルター:
- 日付（Input type="date"でシンプルに）
- バス選択（Select）

## 4. app/(admin)/_components/app-sidebar.tsx に項目追加
既存のナビに以下を追加:
- 「バス管理」→ /buses（Bus アイコン）
- 「再生ログ」→ /logs（BarChart2 アイコン）
- 「設定」→ /settings（Settings アイコン）

# TypeScript ルール・非要件（fetch・supabase・Server Actions不要）
```

---

## 実施順序

| Step | 内容 | Project |
|---|---|---|
| F | Empty / Error / Loading | admin / New Chat |
| G | StatusIndicator | client / New Chat |
| H | モバイル対応 | admin / New Chat |
| I | 認証・エラーページ群 | admin / New Chat |
| J | 共通UIパターン・管理画面強化 | admin / New Chat |
| K | 車内クライアント強化 | client / New Chat |
| L | 設定・管理系画面 | admin / New Chat |

---

## ローカル取り込み後の確認チェックリスト

**F**: コンテンツ一覧が空でEmptyState表示 / ErrorStateのdestructive色 / スピナー回転
**G**: ok=緑・warning=黄・error=赤 / okのみanimate-pulse
**H**: 375px幅でカード表示 / SidebarがモバイルでDrawer開閉
**I**: /loginでログイン画面 / 存在しないURLで404 / error.tsxに'use client'
**J**: ConfirmDialogのdestructiveが赤 / CSVインポートが3ステップ
**K**: OfflineBannerが上部固定 / EndTripDialogが「運行終了」ボタンで開く
**L**: /settingsにタブ / /busesにテーブル / /logsに左右分割
