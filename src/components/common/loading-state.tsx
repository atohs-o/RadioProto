import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type LoadingStateProps = {
  message?: string
  className?: string
}

export function LoadingState({
  message = '読み込み中...',
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        className
      )}
    >
      <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
