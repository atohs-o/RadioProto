'use client'

import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ErrorStateProps = {
  title?: string
  description?: string
  retry?: () => void
  className?: string
}

export function ErrorState({
  title = 'エラーが発生しました',
  description = '問題が発生しました。しばらくしてから再度お試しください。',
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        className
      )}
    >
      <div className="mb-4 text-destructive">
        <AlertCircle className="h-12 w-12" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {retry && (
        <Button variant="outline" onClick={retry} className="mt-4">
          再試行
        </Button>
      )}
    </div>
  )
}
