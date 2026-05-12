'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { haversineDistance } from '@/lib/geo'
import type { GTFSShape } from '@/lib/csv'

const TRIGGER_RADIUS_M = Number(process.env.NEXT_PUBLIC_TRIGGER_RADIUS_M ?? '10')
const PASS_THROUGH_MARGIN_M = 20
const WAYPOINT_TIMEOUT_MIN = Number(process.env.NEXT_PUBLIC_WAYPOINT_TIMEOUT_MIN ?? '5')
const BASE_KMH = 5
const TICK_MS = 100

type SimState = 'idle' | 'running' | 'paused'

export interface SimProgramItem {
  id: string
  position: { lat: number; lng: number }
  locationName: string
  audioFileId?: string | null
}

interface SimulationPanelProps {
  items: SimProgramItem[]
  shapes: GTFSShape[]
  onPositionChange: (pos: { lat: number; lng: number } | null) => void
}

function interpolatePosition(
  path: { lat: number; lng: number }[],
  cumDist: number[],
  dist: number,
): { lat: number; lng: number } {
  if (path.length === 0) return { lat: 0, lng: 0 }
  if (dist <= 0) return path[0]
  const totalLen = cumDist[cumDist.length - 1]
  if (dist >= totalLen) return path[path.length - 1]

  let lo = 0
  let hi = cumDist.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (cumDist[mid] <= dist) lo = mid
    else hi = mid - 1
  }

  const segStart = cumDist[lo]
  const segEnd = cumDist[lo + 1]
  const t = segEnd === segStart ? 0 : (dist - segStart) / (segEnd - segStart)

  return {
    lat: path[lo].lat + t * (path[lo + 1].lat - path[lo].lat),
    lng: path[lo].lng + t * (path[lo + 1].lng - path[lo].lng),
  }
}

export function SimulationPanel({ items, shapes, onPositionChange }: SimulationPanelProps) {
  const [simState, setSimState] = useState<SimState>('idle')
  const [speedInput, setSpeedInput] = useState('30')
  const [displaySeqIdx, setDisplaySeqIdx] = useState(0)
  const [displayStatus, setDisplayStatus] = useState<'待機中' | '移動中' | '再生中'>('待機中')

  // Refs for simulation hot path (avoid stale closures)
  const pathRef = useRef<{ lat: number; lng: number }[]>([])
  const cumDistRef = useRef<number[]>([0])
  const currentDistRef = useRef(0)
  const speedKmhRef = useRef(30)
  const seqIdxRef = useRef(0)
  const hasEnteredRadiusRef = useRef(false)
  const minDistToTargetRef = useRef(Infinity)
  const isPlayingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waypointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemsWithAudioRef = useRef<SimProgramItem[]>([])
  const isRunningRef = useRef(false)
  const onPositionChangeRef = useRef(onPositionChange)

  useEffect(() => { onPositionChangeRef.current = onPositionChange }, [onPositionChange])

  useEffect(() => {
    itemsWithAudioRef.current = items.filter((i) => i.audioFileId)
  }, [items])

  useEffect(() => {
    const allPoints: { lat: number; lng: number }[] = []
    for (const shape of shapes) {
      const sorted = [...shape.points].sort((a, b) => a.seq - b.seq)
      for (const p of sorted) allPoints.push({ lat: p.lat, lng: p.lng })
    }
    pathRef.current = allPoints

    const cumDist = [0]
    for (let i = 1; i < allPoints.length; i++) {
      cumDist.push(cumDist[i - 1] + haversineDistance(allPoints[i - 1], allPoints[i]))
    }
    cumDistRef.current = cumDist
  }, [shapes])

  const clearAudio = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current)
      audioObjectUrlRef.current = null
    }
    isPlayingRef.current = false
  }, [])

  const advanceSeqRef = useRef<() => void>(() => {})

  const playAudio = useCallback(async (item: SimProgramItem) => {
    if (!item.audioFileId || !isRunningRef.current) return
    isPlayingRef.current = true
    setDisplayStatus('再生中')

    try {
      const res = await fetch(`/api/admin/audio/${item.audioFileId}`)
      if (!res.ok) throw new Error('音声URL取得失敗')
      const { signedUrl } = (await res.json()) as { signedUrl: string }

      const audioRes = await fetch(signedUrl)
      if (!audioRes.ok) throw new Error('音声取得失敗')
      const blob = await audioRes.blob()

      if (!isRunningRef.current) return

      const objectUrl = URL.createObjectURL(blob)
      audioObjectUrlRef.current = objectUrl
      const audio = new Audio(objectUrl)
      audioRef.current = audio

      const onDone = () => {
        URL.revokeObjectURL(objectUrl)
        audioObjectUrlRef.current = null
        isPlayingRef.current = false
        if (isRunningRef.current) {
          setDisplayStatus('移動中')
          advanceSeqRef.current()
        }
      }

      audio.addEventListener('ended', onDone, { once: true })
      audio.addEventListener('error', onDone, { once: true })
      await audio.play()
    } catch {
      isPlayingRef.current = false
      if (isRunningRef.current) {
        setDisplayStatus('移動中')
        advanceSeqRef.current()
      }
    }
  }, [])

  const advanceSeq = useCallback(() => {
    if (waypointTimerRef.current) {
      clearTimeout(waypointTimerRef.current)
      waypointTimerRef.current = null
    }
    hasEnteredRadiusRef.current = false
    minDistToTargetRef.current = Infinity

    const nextIdx = seqIdxRef.current + 1
    seqIdxRef.current = nextIdx
    setDisplaySeqIdx(nextIdx)

    const audioItems = itemsWithAudioRef.current
    if (nextIdx >= audioItems.length) {
      setDisplayStatus('待機中')
      return
    }

    setDisplayStatus('移動中')
    const timeoutMs = (WAYPOINT_TIMEOUT_MIN * 60_000 * BASE_KMH) / speedKmhRef.current
    waypointTimerRef.current = setTimeout(() => {
      if (!hasEnteredRadiusRef.current) advanceSeqRef.current()
    }, timeoutMs)
  }, [])

  useEffect(() => { advanceSeqRef.current = advanceSeq }, [advanceSeq])

  const doStop = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }
    if (waypointTimerRef.current) {
      clearTimeout(waypointTimerRef.current)
      waypointTimerRef.current = null
    }
    clearAudio()
    isRunningRef.current = false
    currentDistRef.current = 0
    seqIdxRef.current = 0
    hasEnteredRadiusRef.current = false
    minDistToTargetRef.current = Infinity
    setDisplaySeqIdx(0)
    setSimState('idle')
    setDisplayStatus('待機中')
    onPositionChangeRef.current(null)
  }, [clearAudio])

  const doStopRef = useRef(doStop)
  useEffect(() => { doStopRef.current = doStop }, [doStop])

  const tick = useCallback(() => {
    const path = pathRef.current
    const cumDist = cumDistRef.current
    const totalLen = cumDist[cumDist.length - 1] ?? 0

    if (path.length < 2) return

    const stepM = (speedKmhRef.current / 3.6) * (TICK_MS / 1000)
    currentDistRef.current = Math.min(currentDistRef.current + stepM, totalLen)
    const newPos = interpolatePosition(path, cumDist, currentDistRef.current)
    onPositionChangeRef.current(newPos)

    const audioItems = itemsWithAudioRef.current
    const idx = seqIdxRef.current

    if (idx < audioItems.length) {
      const target = audioItems[idx]
      const dist = haversineDistance(newPos, target.position)

      if (dist <= TRIGGER_RADIUS_M) {
        if (!hasEnteredRadiusRef.current && !isPlayingRef.current) {
          hasEnteredRadiusRef.current = true
          minDistToTargetRef.current = dist
          playAudio(target)
        } else if (dist < minDistToTargetRef.current) {
          minDistToTargetRef.current = dist
        }
      } else if (
        hasEnteredRadiusRef.current &&
        !isPlayingRef.current &&
        dist > minDistToTargetRef.current + PASS_THROUGH_MARGIN_M
      ) {
        advanceSeqRef.current()
      }
    }

    if (currentDistRef.current >= totalLen) {
      doStopRef.current()
    }
  }, [playAudio])

  const tickRef = useRef(tick)
  useEffect(() => { tickRef.current = tick }, [tick])

  const handleStart = useCallback(() => {
    if (pathRef.current.length < 2) return

    currentDistRef.current = 0
    seqIdxRef.current = 0
    hasEnteredRadiusRef.current = false
    minDistToTargetRef.current = Infinity
    isPlayingRef.current = false
    isRunningRef.current = true

    setDisplaySeqIdx(0)
    setSimState('running')
    setDisplayStatus('移動中')

    const audioItems = itemsWithAudioRef.current
    if (audioItems.length > 0) {
      const timeoutMs = (WAYPOINT_TIMEOUT_MIN * 60_000 * BASE_KMH) / speedKmhRef.current
      waypointTimerRef.current = setTimeout(() => {
        if (!hasEnteredRadiusRef.current) advanceSeqRef.current()
      }, timeoutMs)
    }

    tickIntervalRef.current = setInterval(() => tickRef.current(), TICK_MS)
  }, [])

  const handlePause = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }
    if (waypointTimerRef.current) {
      clearTimeout(waypointTimerRef.current)
      waypointTimerRef.current = null
    }
    audioRef.current?.pause()
    isRunningRef.current = false
    setSimState('paused')
  }, [])

  const handleResume = useCallback(() => {
    isRunningRef.current = true
    audioRef.current?.play().catch(() => {})
    setSimState('running')

    const idx = seqIdxRef.current
    const audioItems = itemsWithAudioRef.current
    if (idx < audioItems.length && !hasEnteredRadiusRef.current) {
      const timeoutMs = (WAYPOINT_TIMEOUT_MIN * 60_000 * BASE_KMH) / speedKmhRef.current
      waypointTimerRef.current = setTimeout(() => {
        if (!hasEnteredRadiusRef.current) advanceSeqRef.current()
      }, timeoutMs)
    }

    tickIntervalRef.current = setInterval(() => tickRef.current(), TICK_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
      if (waypointTimerRef.current) clearTimeout(waypointTimerRef.current)
      clearAudio()
      onPositionChangeRef.current(null)
    }
  }, [clearAudio])

  const hasShapes = shapes.some((s) => s.points.length >= 2)
  const itemsWithAudioForDisplay = items.filter((i) => i.audioFileId)
  const currentTarget =
    displaySeqIdx < itemsWithAudioForDisplay.length
      ? itemsWithAudioForDisplay[displaySeqIdx]
      : null

  const handleSpeedBlur = () => {
    const n = Number(speedInput)
    if (isNaN(n) || n < 1 || n > 120) {
      setSpeedInput(String(speedKmhRef.current))
    } else {
      const clamped = Math.max(1, Math.min(120, Math.floor(n)))
      speedKmhRef.current = clamped
      setSpeedInput(String(clamped))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="font-medium text-muted-foreground">シミュレーション</span>

      {/* 再生コントロール */}
      <div className="flex items-center gap-1">
        {simState === 'idle' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStart}
            disabled={!hasShapes}
            title={!hasShapes ? 'shapesデータがありません' : undefined}
            className="h-8 gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            開始
          </Button>
        )}
        {simState === 'running' && (
          <Button size="sm" variant="outline" onClick={handlePause} className="h-8 gap-1.5">
            <Pause className="h-3.5 w-3.5 fill-current" />
            一時停止
          </Button>
        )}
        {simState === 'paused' && (
          <Button size="sm" variant="outline" onClick={handleResume} className="h-8 gap-1.5">
            <Play className="h-3.5 w-3.5 fill-current" />
            再開
          </Button>
        )}
        {simState !== 'idle' && (
          <Button
            size="sm"
            variant="outline"
            onClick={doStop}
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            停止
          </Button>
        )}
      </div>

      {/* 速度倍率 */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">速度</span>
        <Input
          type="number"
          min={1}
          max={120}
          value={speedInput}
          onChange={(e) => {
            const val = e.target.value
            setSpeedInput(val)
            const n = Number(val)
            if (!isNaN(n) && n >= 1 && n <= 120) {
              speedKmhRef.current = Math.floor(n)
            }
          }}
          onBlur={handleSpeedBlur}
          disabled={simState !== 'idle'}
          className="h-8 w-16 text-center"
        />
        <span className="text-muted-foreground">km/h</span>
      </div>

      {/* 再生状態 */}
      <div className="flex items-center gap-1.5 border-l pl-3">
        <span className="text-muted-foreground">状態:</span>
        <span
          className={
            displayStatus === '再生中'
              ? 'font-medium text-green-600'
              : displayStatus === '移動中'
                ? 'font-medium text-blue-600'
                : 'text-muted-foreground'
          }
        >
          {displayStatus}
        </span>
      </div>

      {/* 次のターゲット */}
      <div className="flex items-center gap-1.5 border-l pl-3">
        <span className="text-muted-foreground">次:</span>
        <span className="font-medium">
          {currentTarget ? currentTarget.locationName : '(なし)'}
        </span>
      </div>
    </div>
  )
}
