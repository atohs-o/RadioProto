"use client"

import { WifiOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type OfflineBannerProps = {
  visible: boolean
  onDismiss?: () => void
}

export function OfflineBanner({ visible, onDismiss }: OfflineBannerProps) {
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-brand-red text-white transition-transform duration-300 ease-in-out",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-3">
        <WifiOff className="h-6 w-6 shrink-0" aria-hidden="true" />
        <span className="text-lg font-medium">
          サーバーとの接続が切断されました
        </span>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-11 w-11 min-h-[44px] min-w-[44px] text-white hover:bg-white/20 hover:text-white"
          aria-label="閉じる"
        >
          <X className="h-6 w-6" />
        </Button>
      )}
    </div>
  )
}
