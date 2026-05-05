'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // エラーログをコンソールに出力（本番環境ではログ収集サービスに送信）
    console.error('Application Error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <AlertTriangle className="h-20 w-20 text-brand-warning mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-foreground mb-2">
          エラーが発生しました
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          予期しないエラーが発生しました。
          <br />
          問題が解決しない場合は、管理者にお問い合わせください。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset}>再試行</Button>
          <Link href="/contents">
            <Button variant="outline">管理画面に戻る</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
