'use client'

import { cn } from '@/lib/utils'

type StatusIndicatorProps = {
  status: 'ok' | 'warning' | 'error'
  label: string
  sublabel?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusColors = {
  ok: 'bg-brand-green',
  warning: 'bg-brand-warning',
  error: 'bg-brand-red',
} as const

const sizeStyles = {
  sm: {
    dot: 'h-2 w-2',
    label: 'text-sm',
    sublabel: 'text-xs',
  },
  md: {
    dot: 'h-3 w-3',
    label: 'text-base',
    sublabel: 'text-sm',
  },
  lg: {
    dot: 'h-4 w-4',
    label: 'text-lg',
    sublabel: 'text-base',
  },
} as const

export function StatusIndicator({
  status,
  label,
  sublabel,
  size = 'md',
  className,
}: StatusIndicatorProps) {
  const styles = sizeStyles[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'rounded-full',
          styles.dot,
          statusColors[status],
          status === 'ok' && 'animate-pulse'
        )}
        aria-hidden="true"
      />
      <div className="flex flex-col">
        <span className={cn('font-medium text-foreground', styles.label)}>
          {label}
        </span>
        {sublabel && (
          <span className={cn('text-muted-foreground', styles.sublabel)}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
