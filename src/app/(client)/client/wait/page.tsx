'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { StatusIndicator } from '@/components/client/status-indicator'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ClientBusState } from '@/lib/schemas/client'
import type { GpsStatus, ServerStatus } from '@/lib/types'

export default function WaitPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [busState, setBusState] = useState<ClientBusState | null>(null)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('inactive')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('disconnected')
  const [isLoading, setIsLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)

  type TripEndType = 'auto_terminal' | 'auto_completed' | 'manual' | 'abnormal' | 'timeout' | 'offline' | 'auto' | 'completed'
  const [lastTripEnd, setLastTripEnd] = useState<{ time: string; type: TripEndType } | null>(null)

  const fetchBusState = useCallback(async () => {
    const token = localStorage.getItem('deviceToken')
    if (!token) {
      router.replace('/client/setup')
      return
    }

    try {
      const res = await fetch('/api/client/bus', {
        headers: { 'X-Device-Token': token },
      })
      if (res.status === 401) {
        router.replace('/client/setup')
        return
      }
      if (!res.ok) throw new Error()
      const data: ClientBusState = await res.json()
      setBusState(data)
      setServerStatus('connected')
    } catch {
      setServerStatus('disconnected')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchBusState()
  }, [fetchBusState])

  useEffect(() => {
    const autoEndedAt = sessionStorage.getItem('autoEndedAt')
    if (!autoEndedAt) return
    sessionStorage.removeItem('autoEndedAt')
    toast({ title: `自動終了しました（${autoEndedAt}）` })
  }, [toast])

  // 4-1: 未closeトリップ検出 → 強制close
  useEffect(() => {
    const tripId = localStorage.getItem('current_trip_id')
    if (!tripId) return
    const token = localStorage.getItem('deviceToken')
    if (token) {
      fetch('/api/client/trip', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
        body: JSON.stringify({ tripId }),
      }).catch(() => {})
    }
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const endData = { time: timeStr, type: 'abnormal' as const }
    localStorage.setItem('last_trip_ended_at', JSON.stringify(endData))
    localStorage.removeItem('current_trip_id')
    setLastTripEnd(endData)
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('last_trip_ended_at')
    if (!raw) return
    try {
      setLastTripEnd(JSON.parse(raw) as { time: string; type: TripEndType })
    } catch {
      // 壊れたデータは無視
    }
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchBusState()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchBusState])

  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsStatus(pos.coords.accuracy > 100 ? 'low-accuracy' : 'active'),
      () => setGpsStatus('inactive'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const handleClearManual = useCallback(async () => {
    const token = localStorage.getItem('deviceToken')
    if (!token) return
    setIsClearing(true)
    try {
      await fetch('/api/client/bus', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
        body: JSON.stringify({ action: 'clearManual' }),
      })
      await fetchBusState()
    } finally {
      setIsClearing(false)
    }
  }, [fetchBusState])

  const gpsInfo = {
    active: { status: 'ok' as const, label: '受信中' },
    inactive: { status: 'error' as const, label: '未受信' },
    'low-accuracy': { status: 'warning' as const, label: '精度低下' },
  }[gpsStatus]

  const serverInfo = {
    connected: { status: 'ok' as const, label: '接続中' },
    disconnected: { status: 'error' as const, label: '切断' },
  }[serverStatus]

  const canStart =
    gpsStatus === 'active' && serverStatus === 'connected' && !!busState?.currentProgramId

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col p-6 dark:bg-background">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AutoDJ Radio</h1>
            <p className="text-lg text-muted-foreground">待機中</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => router.push('/client/select')}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">番組選択</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 space-y-6">
        <div className="flex gap-8">
          <StatusIndicator
            status={gpsInfo.status}
            label="GPS"
            sublabel={gpsInfo.label}
            size="lg"
          />
          <StatusIndicator
            status={serverInfo.status}
            label="サーバー"
            sublabel={serverInfo.label}
            size="lg"
          />
          <StatusIndicator
            status="error"
            label="MQTT"
            sublabel="未接続"
            size="lg"
          />
        </div>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-lg text-foreground">
                現在の番組:{' '}
                <span className="font-medium">
                  {busState?.currentProgramName ?? '未設定'}
                </span>
              </p>
              {busState?.isManualOverride && (
                <Badge className="bg-brand-orange text-white">手動設定中</Badge>
              )}
            </div>
            {lastTripEnd && (() => {
              const map: Partial<Record<TripEndType, { text: string; className: string }>> = {
                auto_terminal: { text: `前回 ${lastTripEnd.time} に終点到着で自動終了`,     className: 'text-sm text-muted-foreground' },
                auto_completed:{ text: `前回 ${lastTripEnd.time} に全コンテンツ再生完了`,   className: 'text-sm text-muted-foreground' },
                manual:        { text: `前回 ${lastTripEnd.time} に手動終了`,               className: 'text-sm text-muted-foreground' },
                abnormal:      { text: `前回 ${lastTripEnd.time} に異常終了しました`,       className: 'text-sm text-destructive' },
                timeout:       { text: `前回 ${lastTripEnd.time} にタイムアウトで自動終了`, className: 'text-sm text-yellow-500' },
                offline:       { text: `前回 ${lastTripEnd.time} に接続断で自動終了`,       className: 'text-sm text-yellow-500' },
                // 旧データ互換
                auto:          { text: `前回 ${lastTripEnd.time} に自動終了`,               className: 'text-sm text-muted-foreground' },
                completed:     { text: `前回 ${lastTripEnd.time} に全コンテンツ再生完了`,   className: 'text-sm text-muted-foreground' },
              }
              const entry = map[lastTripEnd.type] ?? { text: `前回 ${lastTripEnd.time} に終了`, className: 'text-sm text-muted-foreground' }
              return <p className={entry.className}>{entry.text}</p>
            })()}
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full"
          disabled={!busState?.isManualOverride || isClearing}
          onClick={handleClearManual}
        >
          {isClearing ? <Spinner className="mr-2 h-4 w-4" /> : null}
          管理画面の設定に戻す
        </Button>
      </main>

      <footer className="mt-6 border-t pt-6">
        <Button
          className={cn(
            'min-h-[80px] w-full text-2xl font-bold transition-all',
            canStart
              ? 'bg-[#FA5012] text-white hover:bg-[#FA5012]/90 animate-pulse'
              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
          )}
          disabled={!canStart}
          onClick={() => router.push(`/client/play?programId=${busState!.currentProgramId}`)}
        >
          <Play className="mr-3 h-7 w-7" />
          再生開始
        </Button>
      </footer>
    </div>
  )
}
