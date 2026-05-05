"use client"

import { useState, useEffect, useCallback } from "react"
import { DynamicMap } from "@/src/components/MapWrapper"
import dynamic from "next/dynamic"
import { DynamicMap } from "@/src/components/MapWrapper"
import { Navigation, Wifi, WifiOff, Radio, Volume2, Power } from "lucide-react"
import { StatusIndicator } from "@/components/client/status-indicator"
import { OfflineBanner } from "@/components/client/offline-banner"
import { PlaybackErrorDialog } from "@/components/client/playback-error-dialog"
import { EndTripDialog } from "@/components/client/end-trip-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { PlaybackState, GpsStatus, ServerStatus } from "@/types"

// Leaflet は SSR 無効化
const PlayMap = dynamic(
  () => import("@/components/client/play-map"),
  { ssr: false }
)

// スタブデータ
const MOCK_ROUTE_POINTS: [number, number][] = [
  [36.3006, 137.8729],
  [36.3100, 137.8750],
  [36.3234, 137.8821],
]

const MOCK_MARKERS = [
  {
    id: "1",
    position: [36.3006, 137.8729] as [number, number],
    status: "played" as const,
    label: "穂高駅前",
  },
  {
    id: "2",
    position: [36.3234, 137.8821] as [number, number],
    status: "waiting" as const,
    label: "大王わさび農場",
  },
]

// スタブ関数
async function getCurrentPlaybackState(): Promise<PlaybackState> {
  // TODO: API接続はClaude Codeが実装
  return {
    currentContent: "安曇野わさび農場 秋の収穫祭",
    queue: ["穂高神社 例大祭のお知らせ", "道の駅 ほりがねの里"],
    gpsStatus: "active",
    serverStatus: "connected",
    externalAudio: false,
  }
}

// GPS ステータス → StatusIndicator の status に変換
function gpsStatusToIndicator(status: GpsStatus): "ok" | "warning" | "error" {
  switch (status) {
    case "active":
      return "ok"
    case "low-accuracy":
      return "warning"
    case "inactive":
      return "error"
  }
}

function gpsStatusLabel(status: GpsStatus): string {
  switch (status) {
    case "active":
      return "受信中"
    case "low-accuracy":
      return "精度低下"
    case "inactive":
      return "未受信"
  }
}

export default function PlayPage() {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentContent: null,
    queue: [],
    gpsStatus: "active",
    serverStatus: "connected",
    externalAudio: false,
  })

  const [currentPosition, setCurrentPosition] = useState<[number, number]>([
    36.3006, 137.8729,
  ])

  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false)
  const [showPlaybackError, setShowPlaybackError] = useState(false)
  const [errorContentTitle, setErrorContentTitle] = useState<string | undefined>()
  const [showEndTripDialog, setShowEndTripDialog] = useState(false)

  // 初期データ取得
  useEffect(() => {
    const loadState = async () => {
      const state = await getCurrentPlaybackState()
      setPlaybackState(state)
    }
    loadState()
  }, [])

  // GPS 監視
  useEffect(() => {
    if (!navigator.geolocation) {
      setPlaybackState((prev) => ({ ...prev, gpsStatus: "inactive" }))
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition([position.coords.latitude, position.coords.longitude])
        setPlaybackState((prev) => ({
          ...prev,
          gpsStatus: position.coords.accuracy > 100 ? "low-accuracy" : "active",
        }))
      },
      () => {
        setPlaybackState((prev) => ({ ...prev, gpsStatus: "inactive" }))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // サーバー接続状態の監視（スタブ）
  useEffect(() => {
    // TODO: WebSocket / MQTT接続の実装はClaude Codeが担当
    const interval = setInterval(() => {
      // スタブ: 接続状態のシミュレーション
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleExternalAudioToggle = useCallback((checked: boolean) => {
    setPlaybackState((prev) => ({ ...prev, externalAudio: checked }))
  }, [])

  const handlePlaybackErrorSkip = useCallback(() => {
    setShowPlaybackError(false)
    // TODO: 次のコンテンツへスキップ
  }, [])

  const handlePlaybackErrorRetry = useCallback(() => {
    setShowPlaybackError(false)
    // TODO: 再生を再試行
  }, [])

  const handleEndTrip = useCallback(() => {
    setShowEndTripDialog(false)
    // TODO: 運行終了処理
    window.location.href = "/client"
  }, [])

  const showOfflineBanner =
    playbackState.serverStatus === "disconnected" && !offlineBannerDismissed

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background dark">
      {/* オフラインバナー */}
      <OfflineBanner
        visible={showOfflineBanner}
        onDismiss={() => setOfflineBannerDismissed(true)}
      />

      {/* 再生エラーダイアログ */}
      <PlaybackErrorDialog
        open={showPlaybackError}
        contentTitle={errorContentTitle}
        onSkip={handlePlaybackErrorSkip}
        onRetry={handlePlaybackErrorRetry}
      />

      {/* 運行終了ダイアログ */}
      <EndTripDialog
        open={showEndTripDialog}
        onOpenChange={setShowEndTripDialog}
        onConfirm={handleEndTrip}
      />

      {/* 地図エリア */}
      <div className="flex-1">
        <PlayMap
          center={[36.3006, 137.8729]}
          zoom={14}
          routePoints={MOCK_ROUTE_POINTS}
          markers={MOCK_MARKERS}
          currentPosition={currentPosition}
        />
      </div>

      {/* ステータスバー */}
      <div className="flex items-center justify-between gap-4 border-t border-border bg-card px-4 py-3">
        {/* 左側: StatusIndicator */}
        <div className="flex items-center gap-6">
          <StatusIndicator
            status={gpsStatusToIndicator(playbackState.gpsStatus)}
            label="GPS"
            sublabel={gpsStatusLabel(playbackState.gpsStatus)}
            size="lg"
          />
          <StatusIndicator
            status={playbackState.serverStatus === "connected" ? "ok" : "error"}
            label="サーバー"
            sublabel={playbackState.serverStatus === "connected" ? "接続中" : "切断"}
            size="lg"
          />
        </div>

        {/* 中央: 再生情報 */}
        <div className="flex flex-1 items-center justify-center gap-6">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-brand-orange" />
            <div className="text-lg">
              <span className="text-muted-foreground">再生中: </span>
              <span className="font-medium text-foreground">
                {playbackState.currentContent ?? "---"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg text-muted-foreground">
              待機中: {playbackState.queue.length}件
            </span>
          </div>
        </div>

        {/* 右側: 外部音声トグルと運行終了 */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-lg text-muted-foreground">外部音声</span>
            <Switch
              checked={playbackState.externalAudio}
              onCheckedChange={handleExternalAudioToggle}
              className="data-[state=checked]:bg-brand-orange"
            />
            <span className="min-w-[40px] text-lg font-medium text-foreground">
              {playbackState.externalAudio ? "ON" : "OFF"}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowEndTripDialog(true)}
            className="min-h-[44px] gap-2 border-destructive text-destructive hover:bg-destructive hover:text-white"
          >
            <Power className="h-5 w-5" />
            <span className="text-lg">運行終了</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
