"use client"

import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

type GpsLostBannerProps = {
  visible: boolean
}

export function GpsLostBanner({ visible }: GpsLostBannerProps) {
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-6 py-4 bg-yellow-500 text-white transition-transform duration-300 ease-in-out",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
      role="alert"
      aria-live="polite"
    >
      <MapPin className="h-6 w-6 shrink-0" aria-hidden="true" />
      <span className="text-lg font-medium">GPS信号を取得できません</span>
    </div>
  )
}
