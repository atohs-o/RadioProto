'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Radio, Volume2, Power } from 'lucide-react'
import { StatusIndicator } from '@/components/client/status-indicator'
import { OfflineBanner } from '@/components/client/offline-banner'
import { GpsLostBanner } from '@/components/client/gps-lost-banner'
import { PlaybackErrorDialog } from '@/components/client/playback-error-dialog'
import { LowProgressDialog } from '@/components/client/low-progress-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/use-toast'
import { haversineDistance, smoothGps } from '@/lib/geo'
import { createLocationChannel, sendLocation } from '@/lib/realtime'
import { tripLogger } from '@/lib/trip-logger'
import type { ClientProgram, ClientProgramItem } from '@/lib/schemas/client'
import type { GpsStatus, ServerStatus } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const PlayMap = dynamic(() => import('@/components/client/play-map'), { ssr: false })

const TRIGGER_RADIUS_M = Number(process.env.NEXT_PUBLIC_TRIGGER_RADIUS_M ?? '10')
const TERMINAL_RADIUS_M = Number(process.env.NEXT_PUBLIC_TERMINAL_RADIUS_M ?? '50')
const AUDIO_TIMEOUT_SEC = Number(process.env.NEXT_PUBLIC_AUDIO_TIMEOUT_SEC ?? '120')
const WAYPOINT_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN ?? '5') * 60_000
const MAX_TRIP_DURATION_MS = Number(process.env.NEXT_PUBLIC_MAX_TRIP_DURATION_MIN ?? '120') * 60_000
const GPS_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_GPS_TIMEOUT_MIN ?? '10') * 60_000
const OFFLINE_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_OFFLINE_TIMEOUT_MIN ?? '30') * 60_000
const PASS_THROUGH_MARGIN_M = 20
const AUDIO_CACHE = 'autodj-audio-v1'
const LOCATION_LOG_INTERVAL_MS = 30_000
const DISTANCE_LOG_NORMAL_MS = 10_000
const DISTANCE_LOG_NEAR_MS = 1_000
const DISTANCE_LOG_NEAR_THRESHOLD_M = 100

type ScriptLine = { speaker: 'speaker1' | 'speaker2'; text: string }
type ScriptEntry = { itemId: string; contentTitle: string; lines: ScriptLine[] }

function parseScript(script: string | null): ScriptLine[] {
  if (!script) return []
  return script
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (l.startsWith('Speaker1:')) return { speaker: 'speaker1' as const, text: l.slice(9).trim() }
      if (l.startsWith('Speaker2:')) return { speaker: 'speaker2' as const, text: l.slice(9).trim() }
      return { speaker: 'speaker1' as const, text: l }
    })
}

function ScriptPanel({ entries }: { entries: ScriptEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className="flex w-1/3 flex-col overflow-hidden border-l border-border" style={{ backgroundColor: '#DEE0E3' }}>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {entries.length === 0 && (
          <p className="text-center text-xs text-brand-gray mt-4">再生が始まると台本が表示されます</p>
        )}
        {entries.map((entry) => (
          <div key={entry.itemId}>
            <div className="text-center text-xs text-brand-gray py-1 border-b border-brand-gray-200 mb-2">
              {entry.contentTitle}
            </div>
            {entry.lines.map((line, i) => (
              <div
                key={i}
                className={`flex mb-2 ${line.speaker === 'speaker1' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed"
                  style={{
                    backgroundColor: line.speaker === 'speaker1' ? '#FA5012' : '#FEDCD0',
                    color: line.speaker === 'speaker1' ? 'white' : '#1a1a1a',
                  }}
                >
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function PlayPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const programId = searchParams.get('programId')
  const { toast } = useToast()

  // UI state
  const [program, setProgram] = useState<ClientProgram | null>(null)
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('inactive')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('disconnected')
  const [playingItemId, setPlayingItemId] = useState<string | null>(null)
  const [playedItemIds, setPlayedItemIds] = useState<Set<string>>(new Set())
  const [queueCount, setQueueCount] = useState(0)
  const [externalAudio, setExternalAudio] = useState(false)
  const [showPlaybackError, setShowPlaybackError] = useState(false)
  const [errorContentTitle, setErrorContentTitle] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [showGpsLostBanner, setShowGpsLostBanner] = useState(false)
  const [showLowProgressDialog, setShowLowProgressDialog] = useState(false)
  const [scriptEntries, setScriptEntries] = useState<ScriptEntry[]>([])

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
  const lastSeenSequenceIdxRef = useRef<number>(-1)
  const prevGpsStatusRef = useRef<GpsStatus | null>(null)
  const prevServerStatusRef = useRef<ServerStatus | null>(null)
  const lastDistanceLogTimeRef = useRef<number>(0)
  // 自動終了管理
  const terminalItemRef = useRef<ClientProgramItem | null>(null)
  const terminateFlagRef = useRef<boolean>(false)
  const terminateTypeRef = useRef<'auto_terminal' | 'timeout' | 'offline' | 'auto_completed'>('auto_terminal')
  const isAutoEndingRef = useRef<boolean>(false)
  const handleAutoEndTripRef = useRef<(type: 'auto_terminal' | 'timeout' | 'offline' | 'auto_completed') => Promise<void>>(async () => {})
  // タイマー管理
  const maxTripTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gpsLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 4-6: 低進捗ダイアログを1度だけ表示
  const lowProgressShownRef = useRef(false)
  // バス案内音声一時停止中の再生位置
  const pausedTimeRef = useRef<number>(0)

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
    const fromIdx = currentSequenceIdxRef.current
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
      if (tripIdRef.current) {
        tripLogger.log(tripIdRef.current, 'sequence_advanced', { from: fromIdx, to: idx, locationName: null })
      }
      if (!terminateFlagRef.current) {
        terminateTypeRef.current = 'auto_completed'
        terminateFlagRef.current = true
        if (!isPlayingRef.current) handleAutoEndTripRef.current('auto_completed')
      }
      return
    }

    const nextTarget = items[idx]
    if (tripIdRef.current) {
      tripLogger.log(tripIdRef.current, 'sequence_advanced', {
        from: fromIdx,
        to: idx,
        locationName: nextTarget.displayName ?? nextTarget.contentTitle ?? null,
      })
    }

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
            handleAutoEndTripRef.current(terminateTypeRef.current)
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
          if (tripIdRef.current) {
            tripLogger.log(tripIdRef.current, 'playback_error', {
              audioFileId: item.audioFileId,
              reason: 'audio_error',
            })
          }
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
      if (tripIdRef.current) {
        tripLogger.log(tripIdRef.current, 'playback_error', {
          audioFileId: item.audioFileId,
          reason: 'fetch_error',
        })
      }
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

      // 実機での二重対策: シーケンスが進んでいたらトラッキング状態を強制リセット
      if (idx !== lastSeenSequenceIdxRef.current) {
        hasEnteredRadiusRef.current = false
        minDistanceToTargetRef.current = Infinity
        lastSeenSequenceIdxRef.current = idx
      }

      const target = items[idx]
      const dist = haversineDistance(smoothed, { lat: target.lat, lng: target.lng })

      // 距離適応ログ（通常 10秒 / POI 100m以内なら 1秒 ごと）
      const now = Date.now()
      const logInterval = dist <= DISTANCE_LOG_NEAR_THRESHOLD_M ? DISTANCE_LOG_NEAR_MS : DISTANCE_LOG_NORMAL_MS
      if (tripIdRef.current && now - lastDistanceLogTimeRef.current >= logInterval) {
        lastDistanceLogTimeRef.current = now
        tripLogger.log(tripIdRef.current, 'location_update', {
          lat: smoothed.lat,
          lng: smoothed.lng,
          accuracy: position.coords.accuracy,
          distanceToTarget: Math.round(dist),
          sequenceIdx: idx,
        })
      }

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
        dist > minDistanceToTargetRef.current + PASS_THROUGH_MARGIN_M &&
        !isPlayingRef.current &&
        !audioQueueRef.current.some((q) => q.id === target.id)
      ) {
        // Pattern B: 通過スキップ（音声未再生かつ未キューの場合のみ）
        recordPlaybackEvent(target.id, 'skipped').catch(() => {})
        advanceToNextSequenceRef.current()
      }

      // 最終ウェイポイント接近チェック
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

        if (currentIdx >= 1 && totalCount > 0 && termDist <= TERMINAL_RADIUS_M) {
          if (passedCount / totalCount >= 0.5) {
            // 正常自動終了
            terminateTypeRef.current = 'auto_terminal'
            terminateFlagRef.current = true
            if (!isPlayingRef.current) handleAutoEndTripRef.current('auto_terminal')
          } else if (!lowProgressShownRef.current) {
            // 4-6: 50%未満で終点接近 → ダイアログ表示
            lowProgressShownRef.current = true
            setShowLowProgressDialog(true)
          }
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
        localStorage.setItem('current_trip_id', tripId)
        tripLogger.setToken(token)
        tripLogger.log(tripId, 'trip_started', { programId: programId ?? '' })

        // 4-2: 最大運行時間タイムアウト
        maxTripTimerRef.current = setTimeout(() => {
          handleAutoEndTripRef.current('timeout')
        }, MAX_TRIP_DURATION_MS)

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
      if (maxTripTimerRef.current) clearTimeout(maxTripTimerRef.current)
      if (gpsLostTimerRef.current) clearTimeout(gpsLostTimerRef.current)
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current)
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

  // 4-3: GPS断絶タイマー（再生開始後のみ）
  useEffect(() => {
    if (isLoading || initError) return
    if (gpsStatus !== 'inactive') {
      if (gpsLostTimerRef.current) {
        clearTimeout(gpsLostTimerRef.current)
        gpsLostTimerRef.current = null
      }
      setShowGpsLostBanner(false)
      return
    }
    gpsLostTimerRef.current = setTimeout(() => setShowGpsLostBanner(true), GPS_TIMEOUT_MS)
    return () => {
      if (gpsLostTimerRef.current) clearTimeout(gpsLostTimerRef.current)
    }
  }, [gpsStatus, isLoading, initError])

  // 4-4: 接続断タイマー
  useEffect(() => {
    if (isLoading || initError) return
    if (serverStatus !== 'disconnected') {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current)
        offlineTimerRef.current = null
      }
      return
    }
    offlineTimerRef.current = setTimeout(() => handleAutoEndTripRef.current('offline'), OFFLINE_TIMEOUT_MS)
    return () => {
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current)
    }
  }, [serverStatus, isLoading, initError])

  // ログ: GPS断絶/復帰
  useEffect(() => {
    if (isLoading || !tripIdRef.current) return
    if (prevGpsStatusRef.current === null) {
      prevGpsStatusRef.current = gpsStatus
      return
    }
    if (prevGpsStatusRef.current !== 'inactive' && gpsStatus === 'inactive') {
      tripLogger.log(tripIdRef.current, 'gps_lost', {})
    } else if (prevGpsStatusRef.current === 'inactive' && gpsStatus !== 'inactive') {
      tripLogger.log(tripIdRef.current, 'gps_recovered', {})
    }
    prevGpsStatusRef.current = gpsStatus
  }, [gpsStatus, isLoading])

  // ログ: サーバー切断/復帰
  useEffect(() => {
    if (isLoading || !tripIdRef.current) return
    if (prevServerStatusRef.current === null) {
      prevServerStatusRef.current = serverStatus
      return
    }
    if (prevServerStatusRef.current === 'connected' && serverStatus === 'disconnected') {
      tripLogger.log(tripIdRef.current, 'server_lost', {})
    } else if (prevServerStatusRef.current === 'disconnected' && serverStatus === 'connected') {
      tripLogger.log(tripIdRef.current, 'server_recovered', {})
    }
    prevServerStatusRef.current = serverStatus
  }, [serverStatus, isLoading])

  // 再生開始時に台本エントリを追加
  useEffect(() => {
    if (!playingItemId || !program) return
    const item = program.items.find((i) => i.id === playingItemId)
    if (!item?.script) return
    setScriptEntries((prev) => {
      if (prev.some((e) => e.itemId === playingItemId)) return prev
      return [...prev, { itemId: playingItemId, contentTitle: item.contentTitle, lines: parseScript(item.script) }]
    })
  }, [playingItemId, program])

  const handleExternalAudioToggle = useCallback((checked: boolean) => {
    externalAudioRef.current = checked
    setExternalAudio(checked)

    if (checked) {
      // ON: 再生中なら一時停止して位置を保存（isPlayingRef は true のまま → GPS が再キューしない）
      if (audioRef.current && isPlayingRef.current) {
        pausedTimeRef.current = audioRef.current.currentTime
        audioRef.current.pause()
      }
    } else {
      // OFF: 一時停止中の音声を再開、なければキューから開始
      if (audioRef.current && isPlayingRef.current) {
        audioRef.current.currentTime = pausedTimeRef.current
        audioRef.current.play().catch(console.error)
      } else {
        playNextFromQueueRef.current()
      }
    }
  }, [])

  const handleAutoEndTrip = useCallback(async (type: 'auto_terminal' | 'timeout' | 'offline' | 'auto_completed') => {
    if (isAutoEndingRef.current) return
    isAutoEndingRef.current = true
    console.log('[AutoEndTrip] 自動終了 type:', type)

    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const timeStr = `${hh}:${mm}`

    if (type === 'timeout') {
      toast({ title: '最大運行時間を超過したため、自動終了しました' })
    } else if (type === 'offline') {
      toast({ title: 'サーバーとの接続が長時間切断されたため、自動終了しました' })
    } else {
      sessionStorage.setItem('autoEndedAt', timeStr)
    }

    localStorage.setItem('last_trip_ended_at', JSON.stringify({ time: timeStr, type }))
    localStorage.removeItem('current_trip_id')

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
    if (maxTripTimerRef.current) clearTimeout(maxTripTimerRef.current)
    if (gpsLostTimerRef.current) clearTimeout(gpsLostTimerRef.current)
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current)
    if (broadcastChannelRef.current) broadcastChannelRef.current.unsubscribe()

    const endEventType =
      type === 'timeout' ? 'timeout_ended' as const :
      type === 'offline' ? 'abnormal_ended' as const :
      'trip_ended' as const
    if (tripIdRef.current) {
      tripLogger.log(tripIdRef.current, endEventType, {
        reason: type,
        totalSequences: sortedItemsRef.current.filter((i) => i.audioFileId).length,
        completedSequences: playedItemIdsRef.current.size,
      })
    }

    router.replace('/client/wait')
    tripLogger.destroy()
  }, [router, toast])

  useEffect(() => {
    handleAutoEndTripRef.current = handleAutoEndTrip
  }, [handleAutoEndTrip])

  const handleEndTrip = useCallback(async () => {
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
    localStorage.removeItem('current_trip_id')

    if (tripIdRef.current) {
      tripLogger.log(tripIdRef.current, 'trip_ended', {
        reason: 'manual',
        totalSequences: sortedItemsRef.current.filter((i) => i.audioFileId).length,
        completedSequences: playedItemIdsRef.current.size,
      })
    }

    router.replace('/client/wait')
    tripLogger.destroy()
  }, [recordPlaybackEvent, router])

  const handleEndTripConfirmation = useCallback(() => {
    // dismiss は toast() の戻り値で得るため、閉じ込めるための container を先に作る
    const dismissRef = { fn: (() => {}) as () => void }
    const { dismiss } = toast({
      title: '運行を終了しますか？',
      description: (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-destructive text-white hover:bg-destructive/90"
            onClick={() => {
              dismissRef.fn()
              handleEndTrip()
            }}
          >
            終了する
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => dismissRef.fn()}>
            キャンセル
          </Button>
        </div>
      ),
      duration: Infinity,
    })
    dismissRef.fn = dismiss
  }, [toast, handleEndTrip])

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

  const shapePoints = (program?.shapes ?? []).flatMap((s) => s.points)
  const sortedItems = (program?.items ?? [])
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  const splitItem = [...sortedItems].reverse().find((item) => playedItemIds.has(item.id)) ?? null

  const playingItem = program?.items.find((i) => i.id === playingItemId)
  const playingLabel = playingItem
    ? (playingItem.displayName ?? playingItem.contentTitle)
    : '---'

  const nextTarget = sortedItems.find((item) => !playedItemIds.has(item.id) && item.id !== playingItemId) ?? null

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background dark">
      <OfflineBanner visible={serverStatus === 'disconnected'} onDismiss={() => {}} />
      <GpsLostBanner visible={showGpsLostBanner} />

      <PlaybackErrorDialog
        open={showPlaybackError}
        contentTitle={errorContentTitle}
        onSkip={() => setShowPlaybackError(false)}
        onRetry={() => setShowPlaybackError(false)}
      />

      <LowProgressDialog
        open={showLowProgressDialog}
        onOpenChange={setShowLowProgressDialog}
        onConfirm={handleEndTrip}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* 左 2/3: ステータスバー + 地図 */}
        <div className="flex w-2/3 flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3">
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

            <div className="flex flex-1 flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-6">
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
              <div className="text-sm text-muted-foreground">
                {nextTarget ? (
                  <>次：{nextTarget.displayName ?? '地点'} / {nextTarget.contentTitle}</>
                ) : (
                  <>次の再生コンテンツはありません</>
                )}
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
                onClick={handleEndTripConfirmation}
                className="min-h-[44px] gap-2 border-destructive text-destructive hover:bg-destructive hover:text-white"
              >
                <Power className="h-5 w-5" />
                <span className="text-lg">運行終了</span>
              </Button>
            </div>
          </div>

          <div className="flex-1">
            <PlayMap
              routePoints={routePoints}
              items={mapItems}
              currentPosition={currentPosition}
              playingItemId={playingItemId ?? undefined}
              playedItemIds={[...playedItemIds]}
              shapePoints={shapePoints}
              splitItem={splitItem}
              triggerRadiusM={TRIGGER_RADIUS_M}
            />
          </div>
        </div>

        {/* 右 1/3: 台本パネル */}
        <ScriptPanel entries={scriptEntries} />
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
