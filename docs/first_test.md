src/lib/geo.ts と車内クライアントのsequence管理ロジックに対してテストを書いてください。

対象：
1. src/lib/geo.ts
   - haversineDistance: 既知の2点間距離の検証
   - smoothGps: 直近3点平均の計算検証

2. sequence管理の3パターン（src/app/(client)/client/play/page.tsx）
   - Pattern A: 10m圏内進入→再生完了→N+1
   - Pattern B: hasEnteredRadius=true + 20m以上離脱→skipped→N+1
   - Pattern C: タイムアウト経過→skipped→N+1

テストフレームワークはvitest（Next.js環境と相性が良い）を使ってください。