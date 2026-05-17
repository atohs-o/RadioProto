'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Radio, Volume2, Power } from 'lucide-react'
import { StatusIndicator } from '@/components/client/status-indicator'
import { OfflineBanner } from '@/components/client/offline-banner'
import { PlaybackErrorDialog } from '@/components/client/playback-error-dialog'
import { EndTripDialog } from '@/components/client/end-trip-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { haversineDistance, smoothGps } from '@/lib/geo'
import { createLocationChannel, sendLocation } from '@/lib/realtime'
import type { ClientProgram, ClientProgramItem } from '@/lib/schemas/client'
import type { GpsStatus, ServerStatus } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const PlayMap = dynamic(() => import('@/components/client/play-map'), { ssr: false })

const TRIGGER_RADIUS_M = Number(process.env.NEXT_PUBLIC_TRIGGER_RADIUS_M ?? '10')
const TERMINAL_RADIUS_M = Number(process.env.NEXT_PUBLIC_TERMINAL_RADIUS_M ?? '50')
const AUDIO_TIMEOUT_SEC = Number(process.env.NEXT_PUBLIC_AUDIO_TIMEOUT_SEC ?? '120')
const WAYPOINT_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN ?? '5') * 60_000
const PASS_THROUGH_MARGIN_M = 20
const AUDIO_CACHE = 'autodj-audio-v1'
const LOCATION_LOG_INTERVAL_MS = 30_000

function PlayPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const programId = searchParams.get('programId')

  // UI state
  const [program, setProgram] = useState<ClientProgram | null>(null)
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('inactive')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('disconnected')
  const [playingItemId, setPlayingItemId] = useState<string | null>(null)
  const [playedItemIds, setPlayedItemIds] = useState<Set<string>>(new Set())
  const [queueCount, setQueueCount] = useState(0)
  const [externalAudio, setExternalAudio] = useState(false)
  const [showEndTripDialog, setShowEndTripDialog] = useState(false)
  const [showPlaybackError, setShowPlaybackError] = useState(false)
  const [errorContentTitle, setErrorContentTitle] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  // Refs（GPSコールバックや音声コールバックで最新値を参照するため）
  const deviceTokenRef = useRef<string | null>(null)
  const tripIdRef = useRef<string | null>(null)
  // 自己再帰コールを stale closure なしで行うための ref
  const playNextFromQueueRef = useRef<() => Promise<void>>(async () => {})
  const programRef = useRef<ClientProgram | null>(null)
  const isPlayingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentObjectUrlRef = useRef<string | null>(null)
  const currentPlayingItemRef = useRef<ClientProgramItem | null>(null)
  const audioQueueRef = useRef<ClientProgramItem[]>([])
  const playedItemIdsRef = useRef<Set<string>>(new Set())
  const externalAudioRef = useRef(false)
  const positionHistoryRef = useRef<Array<{ lat: number; lng: number }>>([])
  const lastHeadingRef = useRef<number | null>(null)
  const lastSpeedKmhRef = useRef<number | null>(null)
  const lastSmoothedPositionRef = useRef<{ lat: number; lng: number } | null>(null)
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null)
  const gpsWatchIdRef = useRef<number | null>(null)
  const locationLogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // sequence 管理
  const sortedItemsRef = useRef<ClientProgramItem[]>([])
  const currentSequenceIdxRef = useRef<number>(0)
  const hasEnteredRadiusRef = useRef<boolean>(false)
  const minDistanceToTargetRef = useRef<number>(Infinity)
  const waypointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceToNextSequenceRef = useRef<() => void>(() => {})
  // 自動終了管理
  const terminalItemRef = useRef<ClientProgramItem | null>(null)
  const terminateFlagRef = useRef<boolean>(false)
  const isAutoEndingRef = useRef<boolean>(false)
  const handleAutoEndTripRef = useRef<() => Promise<void>>(async () => {})

  const recordPlaybackEvent = useCallback(
    async (
      itemId: string,
      status: 'played' | 'skipped' | 'failed' | 'cancelled',
      durationSeconds?: number,
    ) => {
      if (!tripIdRef.current || !deviceTokenRef.current) return
      try {
        await fetch('/api/client/playback-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Token': deviceTokenRef.current,
          },
          body: JSON.stringify({
            tripId: tripIdRef.current,
            radioProgramItemId: itemId,
            status,
            durationSeconds,
          }),
        })
      } catch (err) {
        console.error('再生イベント記録エラー:', err)
      }
    },
    [],
  )

  // 次5本を Cache API にバイナリキャッシュ（バックグラウンド）
  const precacheAudio = useCallback(async () => {
    if (!programRef.current || !deviceTokenRef.current) return
    if (!('caches' in window)) return

    const toPrecache = programRef.current.items
      .filter((item) => item.audioFileId && !playedItemIdsRef.current.has(item.id))
      .slice(0, 5)

    const cache = await caches.open(AUDIO_CACHE)
    for (const item of toPrecache) {
      if (!item.audioFileId) continue
      const cacheKey = new Request(`/audio-cache/${item.audioFileId}`)
      if (await cache.match(cacheKey)) continue

      try {
        const res = await fetch(`/api/client/audio/${item.audioFileId}`, {
          headers: { 'X-Device-Token': deviceTokenRef.current! },
        })
        if (!res.ok) continue
        const { signedUrl } = (await res.json()) as { signedUrl: string }

        const audioRes = await fetch(signedUrl)
        if (!audioRes.ok) continue
        await cache.put(cacheKey, audioRes)
      } catch (err) {
        console.error('音声プリキャッシュエラー:', err)
      }
    }
  }, [])

  const advanceToNextSequence = useCallback(() => {
    if (waypointTimerRef.current) {
      clearTimeout(waypointTimerRef.current)
      waypointTimerRef.current = null
    }
    currentSequenceIdxRef.current += 1
    hasEnteredRadiusRef.current = false
    minDistanceToTargetRef.current = Infinity

    const items = sortedItemsRef.current
    while (
      currentSequenceIdxRef.current < items.length &&
      !items[currentSequenceIdxRef.current].audioFileId
    ) {
      currentSequenceIdxRef.current += 1
    }

    const idx = currentSequenceIdxRef.current
    if (idx >= items.length) {
      if (!terminateFlagRef.current) {
        terminateFlagRef.current = true
        if (!isPlayingRef.current) handleAutoEndTripRef.current()
      }
      return
    }

    const nextTarget = items[idx]

    waypointTimerRef.current = setTimeout(() => {
      if (!hasEnteredRadiusRef.current) {
        recordPlaybackEvent(nextTarget.id, 'skipped').catch(() => {})
        advanceToNextSequenceRef.current()
      }
    }, WAYPOINT_TIMEOUT_MS)

    if (lastSmoothedPositionRef.current) {
      const dist = haversineDistance(lastSmoothedPositionRef.current, {
        lat: nextTarget.lat,
        lng: nextTarget.lng,
      })
      if (dist <= TRIGGER_RADIUS_M) {
        hasEnteredRadiusRef.current = true
        minDistanceToTargetRef.current = dist
        if (!audioQueueRef.current.some((q) => q.id === nextTarget.id)) {
          audioQueueRef.current = [...audioQueueRef.current, nextTarget]
          setQueueCount(audioQueueRef.current.length)
          if (!isPlayingRef.current) playNextFromQueueRef.current()
        }
      }
    }
  }, [recordPlaybackEvent])

  useEffect(() => {
    advanceToNextSequenceRef.current = advanceToNextSequence
  }, [advanceToNextSequence])

  const playNextFromQueue = useCallback(async () => {
    if (isPlayingRef.current) return
    if (audioQueueRef.current.length === 0) return
    if (externalAudioRef.current) return

    const item = audioQueueRef.current[0]
    if (!item.audioFileId) {
      audioQueueRef.current = audioQueueRef.current.slice(1)
      setQueueCount(audioQueueRef.current.length)
      return
    }

    isPlayingRef.current = true
    currentPlayingItemRef.current = item
    setPlayingItemId(item.id)

    try {
      const cache = 'caches' in window ? await caches.open(AUDIO_CACHE) : null
      const cacheKey = new Request(`/audio-cache/${item.audioFileId}`)

      let objectUrl: string
      const cached = cache ? await cache.match(cacheKey) : null
      if (cached) {
        objectUrl = URL.createObjectURL(await cached.blob())
      } else {
        const controller = new AbortController()
        const timerId = setTimeout(() => controller.abort(), AUDIO_TIMEOUT_SEC * 1000)
        try {
          const res = await fetch(`/api/client/audio/${item.audioFileId}`, {
            headers: { 'X-Device-Token': deviceTokenRef.current! },
            signal: controller.signal,
          })
          const { signedUrl } = (await res.json()) as { signedUrl: string }
          const audioRes = await fetch(signedUrl, { signal: controller.signal })
          objectUrl = URL.createObjectURL(await audioRes.blob())
        } finally {
          clearTimeout(timerId)
        }
      }

      currentObjectUrlRef.current = objectUrl
      const audio = new Audio(objectUrl)
      audioRef.current = audio

      audio.addEventListener(
        'ended',
        () => {
          URL.revokeObjectURL(objectUrl)
          currentObjectUrlRef.current = null
          cache?.delete(cacheKey)

          const duration = audio.duration
          recordPlaybackEvent(
            item.id,
            'played',
            isFinite(duration) ? Math.floor(duration) : undefined,
          )

          playedItemIdsRef.current = new Set([...playedItemIdsRef.current, item.id])
          setPlayedItemIds(new Set(playedItemIdsRef.current))

          audioQueueRef.current = audioQueueRef.current.slice(1)
          setQueueCount(audioQueueRef.current.length)

          isPlayingRef.current = false
          currentPlayingItemRef.current = null
          setPlayingItemId(null)

          if (terminateFlagRef.current) {
            handleAutoEndTripRef.current()
          } else {
            advanceToNextSequenceRef.current()
          }
        },
        { once: true },
      )

      audio.addEventListener(
        'error',
        () => {
          URL.revokeObjectURL(objectUrl)
          currentObjectUrlRef.current = null

          recordPlaybackEvent(item.id, 'failed')

          audioQueueRef.current = audioQueueRef.current.slice(1)
          setQueueCount(audioQueueRef.current.length)

          isPlayingRef.current = false
          currentPlayingItemRef.current = null
          setPlayingItemId(null)
          setErrorContentTitle(item.displayName ?? item.contentTitle)
          setShowPlaybackError(true)

          playNextFromQueueRef.current()
        },
        { once: true },
      )

      await audio.play()
    } catch (err) {
      console.error('音声再生エラー:', err)
      recordPlaybackEvent(item.id, 'failed')

      audioQueueRef.current = audioQueueRef.current.slice(1)
      setQueueCount(audioQueueRef.current.length)
      isPlayingRef.current = false
      currentPlayingItemRef.current = null
      setPlayingItemId(null)
      setErrorContentTitle(item.displayName ?? item.contentTitle)
      setShowPlaybackError(true)
    }
  }, [recordPlaybackEvent])

  // ref を常に最新の関数に同期
  useEffect(() => {
    playNextFromQueueRef.current = playNextFromQueue
  }, [playNextFromQueue])

  // GPS更新ハンドラ
  const handlePositionUpdate = useCallback(
    (position: GeolocationPosition) => {
      const pos = { lat: position.coords.latitude, lng: position.coords.longitude }

      positionHistoryRef.current = [...positionHistoryRef.current, pos].slice(-3)
      const smoothed = smoothGps(positionHistoryRef.current)
      lastSmoothedPositionRef.current = smoothed

      const heading = position.coords.heading ?? null
      const speedKmh = position.coords.speed != null ? position.coords.speed * 3.6 : null
      lastHeadingRef.current = heading
      lastSpeedKmhRef.current = speedKmh

      setCurrentPosition(smoothed)
      setGpsStatus(position.coords.accuracy > 100 ? 'low-accuracy' : 'active')

      if (broadcastChannelRef.current) {
        sendLocation(broadcastChannelRef.current, smoothed.lat, smoothed.lng, heading, speedKmh).catch(() => {})
      }

      const items = sortedItemsRef.current
      const idx = currentSequenceIdxRef.current
      if (idx >= items.length) return

      const target = items[idx]
      const dist = haversineDistance(smoothed, { lat: target.lat, lng: target.lng })

      if (dist <= TRIGGER_RADIUS_M) {
        hasEnteredRadiusRef.current = true
        if (dist < minDistanceToTargetRef.current) minDistanceToTargetRef.current = dist
        if (!audioQueueRef.current.some((q) => q.id === target.id) && !isPlayingRef.current) {
          audioQueueRef.current = [...audioQueueRef.current, target]
          setQueueCount(audioQueueRef.current.length)
          playNextFromQueue()
        }
      } else if (
        hasEnteredRadiusRef.current &&
        dist > minDistanceToTargetRef.current + PASS_THROUGH_MARGIN_M
      ) {
        // Pattern B: 通過スキップ
        recordPlaybackEvent(target.id, 'skipped').catch(() => {})
        advanceToNextSequenceRef.current()
      }

      // 最終ウェイポイント接近チェック（3条件AND）
      if (terminalItemRef.current && !terminateFlagRef.current) {
        const termDist = haversineDistance(smoothed, {
          lat: terminalItemRef.current.lat,
          lng: terminalItemRef.current.lng,
        })
        const currentIdx = currentSequenceIdxRef.current
        const totalCount = sortedItemsRef.current.filter((i) => i.audioFileId).length
        const passedCount = sortedItemsRef.current
          .slice(0, currentIdx)
          .filter((i) => i.audioFileId).length

        if (
          currentIdx >= 1 &&
          totalCount > 0 &&
          passedCount / totalCount >= 0.5 &&
          termDist <= TERMINAL_RADIUS_M
        ) {
          terminateFlagRef.current = true
          if (!isPlayingRef.current) handleAutoEndTripRef.current()
        }
      }
    },
    [playNextFromQueue, recordPlaybackEvent],
  )

  // 初期化（認証・番組取得・trip開始・Realtime接続）
  useEffect(() => {
    if (!programId) {
      router.replace('/client/wait')
      return
    }
    const token = localStorage.getItem('deviceToken')
    if (!token) {
      router.replace('/client/setup')
      return
    }
    deviceTokenRef.current = token

    const init = async () => {
      try {
        // 番組データ取得
        const progRes = await fetch('/api/client/program', {
          headers: { 'X-Device-Token': token },
        })
        if (progRes.status === 401) { router.replace('/client/setup'); return }
        if (!progRes.ok) throw new Error('番組データの取得に失敗しました')

        const progs: ClientProgram[] = await progRes.json()
        const found = progs.find((p) => p.id === programId)
        if (!found) { router.replace('/client/wait'); return }

        programRef.current = found
        setProgram(found)
        setServerStatus('connected')

        // 運行開始
        const tripRes = await fetch('/api/client/trip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
          body: JSON.stringify({ radioProgramId: programId }),
        })
        if (!tripRes.ok) throw new Error('運行開始に失敗しました')
        const { tripId } = (await tripRes.json()) as { tripId: string }
        tripIdRef.current = tripId

        // Realtime broadcast チャンネル接続（bus_id 取得）
        const authRes = await fetch('/api/client/auth', {
          headers: { 'X-Device-Token': token },
        })
        if (authRes.ok) {
          const { busId } = (await authRes.json()) as { busId: string }
          const channel = createLocationChannel(busId)
          await channel.subscribe()
          broadcastChannelRef.current = channel
        }

        // sequence 昇順ソート（null は末尾）
        sortedItemsRef.current = [...found.items].sort((a, b) => {
          if (a.sequence === null && b.sequence === null) return 0
          if (a.sequence === null) return 1
          if (b.sequence === null) return -1
          return a.sequence - b.sequence
        })
        terminalItemRef.current =
          sortedItemsRef.current.filter((i) => i.audioFileId).at(-1) ?? null

        // audioFileId のない先頭アイテムを連続スキップ
        currentSequenceIdxRef.current = 0
        while (
          currentSequenceIdxRef.current < sortedItemsRef.current.length &&
          !sortedItemsRef.current[currentSequenceIdxRef.current].audioFileId
        ) {
          currentSequenceIdxRef.current += 1
        }

        // 最初のターゲットのタイムアウトタイマー開始（Pattern C）
        const firstTarget = sortedItemsRef.current[currentSequenceIdxRef.current]
        if (firstTarget) {
          waypointTimerRef.current = setTimeout(() => {
            if (!hasEnteredRadiusRef.current) {
              recordPlaybackEvent(firstTarget.id, 'skipped').catch(() => {})
              advanceToNextSequenceRef.current()
            }
          }, WAYPOINT_TIMEOUT_MS)
        }

        setIsLoading(false)
        // バックグラウンドで音声をプリキャッシュ
        precacheAudio()
      } catch (err) {
        console.error('初期化エラー:', err)
        setInitError(err instanceof Error ? err.message : '初期化に失敗しました')
        setIsLoading(false)
      }
    }

    init()
  }, [programId, router, precacheAudio])

  // GPS監視（初期値はすでに 'inactive'）
  useEffect(() => {
    if (isLoading || initError) return
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      () => setGpsStatus('inactive'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    )
    gpsWatchIdRef.current = watchId
    return () => navigator.geolocation.clearWatch(watchId)
  }, [isLoading, initError, handlePositionUpdate])

  // 位置ログ（30秒間引き）
  useEffect(() => {
    if (isLoading || initError) return

    const interval = setInterval(() => {
      if (!tripIdRef.current || !deviceTokenRef.current) return
      if (positionHistoryRef.current.length === 0) return
      const pos = smoothGps(positionHistoryRef.current)

      fetch('/api/client/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Token': deviceTokenRef.current },
        body: JSON.stringify({
          tripId: tripIdRef.current,
          lat: pos.lat,
          lng: pos.lng,
          heading: lastHeadingRef.current ?? undefined,
          speedKmh: lastSpeedKmhRef.current ?? undefined,
        }),
      }).catch((err) => console.error('位置ログエラー:', err))
    }, LOCATION_LOG_INTERVAL_MS)

    locationLogIntervalRef.current = interval
    return () => clearInterval(interval)
  }, [isLoading, initError])

  // アンマウント時クリーンアップ
  useEffect(() => {
    return () => {
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current)
      }
      if (locationLogIntervalRef.current) clearInterval(locationLogIntervalRef.current)
      if (waypointTimerRef.current) clearTimeout(waypointTimerRef.current)
      if (broadcastChannelRef.current) broadcastChannelRef.current.unsubscribe()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current)
        currentObjectUrlRef.current = null
      }
    }
  }, [])

  const handleExternalAudioToggle = useCallback(
    (checked: boolean) => {
      externalAudioRef.current = checked
      setExternalAudio(checked)

      if (checked && isPlayingRef.current && currentPlayingItemRef.current) {
        const item = currentPlayingItemRef.current
        if (currentObjectUrlRef.current) {
          URL.revokeObjectURL(currentObjectUrlRef.current)
          currentObjectUrlRef.current = null
        }
        audioRef.current?.pause()
        audioRef.current = null
        recordPlaybackEvent(item.id, 'cancelled')
        isPlayingRef.current = false
        currentPlayingItemRef.current = null
        setPlayingItemId(null)
      }
    },
    [recordPlaybackEvent],
  )

  const handleAutoEndTrip = useCallback(async () => {
    if (isAutoEndingRef.current) return
    isAutoEndingRef.current = true

    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const timeStr = `${hh}:${mm}`
    sessionStorage.setItem('autoEndedAt', timeStr)
    localStorage.setItem('last_trip_ended_at', JSON.stringify({ time: timeStr, type: 'auto' }))

    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current)
      currentObjectUrlRef.current = null
    }
    audioRef.current?.pause()
    audioRef.current = null

    if (tripIdRef.current && deviceTokenRef.current) {
      await fetch('/api/client/trip', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Device-Token': deviceTokenRef.current },
        body: JSON.stringify({ tripId: tripIdRef.current }),
      }).catch((err) => console.error('自動運行終了エラー:', err))
    }

    if (gpsWatchIdRef.current !== null) navigator.geolocation.clearWatch(gpsWatchIdRef.current)
    if (locationLogIntervalRef.current) clearInterval(locationLogIntervalRef.current)
    if (waypointTimerRef.current) clearTimeout(waypointTimerRef.current)
    if (broadcastChannelRef.current) broadcastChannelRef.current.unsubscribe()

    router.replace('/client/wait')
  }, [router])

  useEffect(() => {
    handleAutoEndTripRef.current = handleAutoEndTrip
  }, [handleAutoEndTrip])

  const handleEndTrip = useCallback(async () => {
    setShowEndTripDialog(false)

    // 再生中なら cancelled 記録
    if (isPlayingRef.current && currentPlayingItemRef.current) {
      recordPlaybackEvent(currentPlayingItemRef.current.id, 'cancelled')
    }
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current)
      currentObjectUrlRef.current = null
    }
    audioRef.current?.pause()
    audioRef.current = null

    // 運行終了
    if (tripIdRef.current && deviceTokenRef.current) {
      await fetch('/api/client/trip', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Device-Token': deviceTokenRef.current },
        body: JSON.stringify({ tripId: tripIdRef.current }),
      }).catch((err) => console.error('運行終了エラー:', err))
    }

    if (gpsWatchIdRef.current !== null) navigator.geolocation.clearWatch(gpsWatchIdRef.current)
    if (locationLogIntervalRef.current) clearInterval(locationLogIntervalRef.current)
    if (broadcastChannelRef.current) broadcastChannelRef.current.unsubscribe()

    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    localStorage.setItem('last_trip_ended_at', JSON.stringify({ time: `${hh}:${mm}`, type: 'manual' }))

    router.replace('/client/wait')
  }, [recordPlaybackEvent, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background dark">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-6 dark">
        <p className="text-lg text-destructive">{initError}</p>
        <Button onClick={() => router.replace('/client/wait')}>待機画面に戻る</Button>
      </div>
    )
  }

  const routePoints = program?.items.map((item) => ({ lat: item.lat, lng: item.lng })) ?? []
  const mapItems = (program?.items ?? []).map((item) => ({
    id: item.id,
    position: { lat: item.lat, lng: item.lng },
    locationName: item.displayName ?? '地点',
    contentTitle: item.contentTitle,
    audioDurationSec: item.durationSeconds ?? 0,
  }))

  const playingItem = program?.items.find((i) => i.id === playingItemId)
  const playingLabel = playingItem
    ? (playingItem.displayName ?? playingItem.contentTitle)
    : '---'

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background dark">
      <OfflineBanner visible={serverStatus === 'disconnected'} onDismiss={() => {}} />

      <PlaybackErrorDialog
        open={showPlaybackError}
        contentTitle={errorContentTitle}
        onSkip={() => setShowPlaybackError(false)}
        onRetry={() => setShowPlaybackError(false)}
      />

      <EndTripDialog
        open={showEndTripDialog}
        onOpenChange={setShowEndTripDialog}
        onConfirm={handleEndTrip}
      />

      <div className="flex-1">
        <PlayMap
          routePoints={routePoints}
          items={mapItems}
          currentPosition={currentPosition}
          playingItemId={playingItemId ?? undefined}
          playedItemIds={[...playedItemIds]}
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border bg-card px-4 py-3">
        <div className="flex items-center gap-6">
          <StatusIndicator
            status={gpsStatus === 'active' ? 'ok' : gpsStatus === 'low-accuracy' ? 'warning' : 'error'}
            label="GPS"
            sublabel={
              gpsStatus === 'active' ? '受信中' : gpsStatus === 'low-accuracy' ? '精度低下' : '未受信'
            }
            size="lg"
          />
          <StatusIndicator
            status={serverStatus === 'connected' ? 'ok' : 'error'}
            label="サーバー"
            sublabel={serverStatus === 'connected' ? '接続中' : '切断'}
            size="lg"
          />
          <StatusIndicator
            status="error"
            label="MQTT"
            sublabel="未接続"
            size="lg"
          />
        </div>

        <div className="flex flex-1 items-center justify-center gap-6">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-brand-orange" />
            <div className="text-lg">
              <span className="text-muted-foreground">再生中: </span>
              <span className="font-medium text-foreground">{playingLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg text-muted-foreground">待機中: {queueCount}件</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-lg text-muted-foreground">バス案内音声</span>
            <Switch
              checked={externalAudio}
              onCheckedChange={handleExternalAudioToggle}
              className="data-[state=checked]:bg-brand-orange"
            />
            <span className="min-w-[40px] text-lg font-medium text-foreground">
              {externalAudio ? 'ON' : 'OFF'}
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

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background dark">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <PlayPageContent />
    </Suspense>
  )
}
