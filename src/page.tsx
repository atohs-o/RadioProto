'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Radio,
  Satellite,
  Wifi,
  Volume2,
  List,
  Headphones,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { LoadingState } from '@/components/common'
import { getProgram } from '@/lib/stubs'
import type { Program } from '@/lib/types'

// Leaflet は SSR 無効化
const PlayMap = dynamic(
  () => import('@/components/map/play-map').then((mod) => mod.PlayMap),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-muted">地図を読み込み中...</div> }
)

type GpsStatus = 'active' | 'inactive' | 'low-accuracy'
type ServerStatus = 'connected' | 'disconnected'

const gpsStatusConfig: Record<GpsStatus, { label: string; className: string }> = {
  active: { label: '受信中', className: 'bg-brand-green text-white' },
  inactive: { label: '未受信', className: 'bg-destructive text-white' },
  'low-accuracy': { label: '精度低下', className: 'bg-brand-warning text-white' },
}

const serverStatusConfig: Record<ServerStatus, { label: string; className: string }> = {
  connected: { label: '接続中', className: 'bg-brand-green text-white' },
  disconnected: { label: '切断', className: 'bg-destructive text-white' },
}

function PlayPageContent() {
  const searchParams = useSearchParams()
  const programId = searchParams.get('programId')

  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)

  // 再生状態
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | undefined>()
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('active')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('connected')
  const [playingItemId, setPlayingItemId] = useState<string | undefined>()
  const [playedItemIds, setPlayedItemIds] = useState<string[]>([])
  const [currentContentName, setCurrentContentName] = useState<string | undefined>()
  const [remainingTime, setRemainingTime] = useState<number>(0)
  const [externalAudio, setExternalAudio] = useState(false)

  useEffect(() => {
    if (programId) {
      getProgram(programId).then((p) => {
        setProgram(p)
        setLoading(false)
        // 最初のアイテムを再生中としてシミュレーション
        if (p && p.items.length > 0) {
          setPlayingItemId(p.items[0].id)
          setCurrentContentName(p.items[0].contentTitle)
          setRemainingTime(p.items[0].audioDurationSec)
        }
      })
    } else {
      setLoading(false)
    }
  }, [programId])

  // GPS位置の追跡
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          if (position.coords.accuracy > 100) {
            setGpsStatus('low-accuracy')
          } else {
            setGpsStatus('active')
          }
        },
        () => {
          setGpsStatus('inactive')
        },
        { enableHighAccuracy: true }
      )

      return () => navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // 残り時間カウントダウン（デモ用）
  useEffect(() => {
    if (remainingTime > 0 && playingItemId) {
      const timer = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            // 次のコンテンツに移動
            if (program) {
              const currentIndex = program.items.findIndex((i) => i.id === playingItemId)
              if (currentIndex >= 0) {
                setPlayedItemIds((prev) => [...prev, playingItemId])
                if (currentIndex < program.items.length - 1) {
                  const nextItem = program.items[currentIndex + 1]
                  setPlayingItemId(nextItem.id)
                  setCurrentContentName(nextItem.contentTitle)
                  return nextItem.audioDurationSec
                } else {
                  setPlayingItemId(undefined)
                  setCurrentContentName(undefined)
                  return 0
                }
              }
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [remainingTime, playingItemId, program])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const queueCount = program
    ? program.items.length - playedItemIds.length - (playingItemId ? 1 : 0)
    : 0

  if (loading) {
    return <LoadingState message="再生準備中..." />
  }

  if (!program) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-lg text-muted-foreground">番組が見つかりません</p>
        <Button asChild className="mt-4">
          <Link href="/client">戻る</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      {/* ヘッダー */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" />
          <span className="font-semibold">{program.name}</span>
        </div>
        <Button variant="destructive" size="sm" asChild>
          <Link href="/client">
            <Square className="mr-1 h-4 w-4" />
            停止
          </Link>
        </Button>
      </header>

      {/* 地図エリア */}
      <div className="flex-1">
        <PlayMap
          routePoints={program.routePoints}
          items={program.items}
          currentPosition={currentPosition}
          playingItemId={playingItemId}
          playedItemIds={playedItemIds}
        />
      </div>

      {/* ステータスバー */}
      <div className="border-t border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* GPS */}
          <div className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">GPS</span>
            <Badge className={`text-xs ${gpsStatusConfig[gpsStatus].className}`}>
              {gpsStatusConfig[gpsStatus].label}
            </Badge>
          </div>

          {/* サーバー通信 */}
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">通信</span>
            <Badge className={`text-xs ${serverStatusConfig[serverStatus].className}`}>
              {serverStatusConfig[serverStatus].label}
            </Badge>
          </div>

          {/* 現在再生 */}
          <div className="flex flex-1 items-center gap-2 min-w-[200px]">
            <Volume2 className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">再生中:</span>
            {currentContentName ? (
              <>
                <span className="font-medium truncate max-w-[150px]">{currentContentName}</span>
                <Badge variant="outline" className="text-xs">
                  残り {formatTime(remainingTime)}
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>

          {/* キュー */}
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">待機:</span>
            <Badge variant="secondary" className="text-xs">
              {queueCount} 件
            </Badge>
          </div>

          {/* 外部音声入力 */}
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">外部入力</span>
            <Switch
              checked={externalAudio}
              onCheckedChange={setExternalAudio}
              className="scale-90"
            />
            <span className={externalAudio ? 'text-brand-green' : 'text-muted-foreground'}>
              {externalAudio ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlayPage() {
  return (
    <Suspense fallback={<LoadingState message="読み込み中..." />}>
      <PlayPageContent />
    </Suspense>
  )
}
