'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { ErrorState } from '@/components/common/error-state'
import type { Trip, PlayEvent, Bus } from '@/types'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  FileText,
  MapPin,
  MapPinOff,
  Navigation,
  Play,
  Shield,
  SkipForward,
  Square,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ElementType } from 'react'

async function fetchBuses(): Promise<Bus[]> {
  const res = await fetch('/api/admin/buses')
  if (!res.ok) throw new Error('バス一覧の取得に失敗しました')
  return res.json() as Promise<Bus[]>
}

async function fetchTrips({ date, busCode }: { date?: string; busCode?: string }): Promise<Trip[]> {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (busCode) params.set('busCode', busCode)
  const res = await fetch(`/api/admin/trips?${params.toString()}`)
  if (!res.ok) throw new Error('運行一覧の取得に失敗しました')
  return res.json() as Promise<Trip[]>
}

async function fetchEvents(tripId: string): Promise<PlayEvent[]> {
  const res = await fetch(`/api/admin/trips/${tripId}/events`)
  if (!res.ok) throw new Error('再生イベントの取得に失敗しました')
  return res.json() as Promise<PlayEvent[]>
}

type TripSystemEvent = {
  id: string
  event_type: string
  metadata: Record<string, unknown>
  occurred_at: string
}

async function fetchSystemEvents(tripId: string): Promise<TripSystemEvent[]> {
  const res = await fetch(`/api/admin/trips/${tripId}/trip-events`)
  if (!res.ok) throw new Error('システムイベントの取得に失敗しました')
  return res.json() as Promise<TripSystemEvent[]>
}

const EVENT_CONFIG: Record<string, { label: string; icon: ElementType; className: string }> = {
  trip_started:    { label: '運行開始',             icon: Play,          className: 'text-green-600' },
  trip_ended:      { label: '運行終了',             icon: Square,        className: 'text-muted-foreground' },
  abnormal_ended:  { label: '異常終了',             icon: AlertTriangle, className: 'text-destructive' },
  timeout_ended:   { label: 'タイムアウト終了',     icon: AlertTriangle, className: 'text-yellow-500' },
  sequence_advanced:{ label: 'Sequence進行',        icon: SkipForward,   className: 'text-orange-500' },
  gps_lost:        { label: 'GPS断絶',             icon: MapPinOff,     className: 'text-destructive' },
  gps_recovered:   { label: 'GPS復帰',             icon: MapPin,        className: 'text-green-600' },
  server_lost:     { label: 'サーバー切断',         icon: WifiOff,       className: 'text-destructive' },
  server_recovered:{ label: 'サーバー復帰',         icon: Wifi,          className: 'text-green-600' },
  auth_failed:     { label: '認証失敗',             icon: Shield,        className: 'text-destructive' },
  playback_error:  { label: '音声エラー',           icon: AlertCircle,   className: 'text-destructive' },
  location_update: { label: '位置更新',             icon: Navigation,    className: 'text-muted-foreground/60' },
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusBadgeVariant(status: PlayEvent['status']): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'played':
      return 'default'
    case 'skipped':
    case 'cancelled':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'default'
  }
}

function getStatusLabel(status: PlayEvent['status']): string {
  switch (status) {
    case 'played':
      return '完了'
    case 'skipped':
      return 'スキップ'
    case 'cancelled':
      return '中断'
    case 'failed':
      return 'エラー'
    default:
      return status
  }
}

export default function LogsPage() {
  const [dateFilter, setDateFilter] = useState('')
  const [busFilter, setBusFilter] = useState<string>('all')
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

  const { data: buses } = useSWR<Bus[]>('buses', fetchBuses)
  const { data: trips, isLoading: isLoadingTrips, error: tripsError, mutate: mutateTrips } = useSWR<Trip[]>(
    ['trips', dateFilter, busFilter],
    () => fetchTrips({
      date: dateFilter || undefined,
      busCode: busFilter !== 'all' ? busFilter : undefined,
    })
  )
  const { data: playEvents, isLoading: isLoadingEvents, error: eventsError, mutate: mutateEvents } = useSWR<PlayEvent[]>(
    selectedTripId ? ['playEvents', selectedTripId] : null,
    () => selectedTripId ? fetchEvents(selectedTripId) : Promise.resolve([])
  )
  const { data: systemEvents, isLoading: isLoadingSystemEvents } = useSWR<TripSystemEvent[]>(
    selectedTripId ? ['systemEvents', selectedTripId] : null,
    () => selectedTripId ? fetchSystemEvents(selectedTripId) : Promise.resolve([])
  )

  const selectedTrip = useMemo(() => {
    return trips?.find(t => t.id === selectedTripId)
  }, [trips, selectedTripId])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">再生ログ</h1>
        <p className="text-muted-foreground">
          運行履歴と再生イベントを確認します
        </p>
      </div>

      <FieldGroup className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field className="sm:w-48">
          <FieldLabel htmlFor="dateFilter">日付</FieldLabel>
          <Input
            id="dateFilter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </Field>
        <Field className="sm:w-48">
          <FieldLabel htmlFor="busFilter">バス</FieldLabel>
          <Select value={busFilter} onValueChange={setBusFilter}>
            <SelectTrigger id="busFilter">
              <SelectValue placeholder="バスを選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {buses?.map((bus) => (
                <SelectItem key={bus.id} value={bus.busCode}>
                  {bus.busCode} - {bus.busName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-4 md:flex-row">
        <Card className="md:w-2/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">運行一覧</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tripsError ? (
              <ErrorState retry={() => mutateTrips()} className="py-8" />
            ) : isLoadingTrips ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6" />
              </div>
            ) : trips?.length === 0 ? (
              <Empty className="py-8">
                <EmptyMedia>
                  <FileText className="size-8" />
                </EmptyMedia>
                <EmptyTitle>運行データがありません</EmptyTitle>
                <EmptyDescription>
                  フィルター条件を変更してください
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="max-h-96 overflow-auto md:max-h-[600px]">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>バス</TableHead>
                      <TableHead className="w-28">運行開始</TableHead>
                      <TableHead className="w-28">運行終了</TableHead>
                      <TableHead className="w-14 text-right">再生数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips?.map((trip) => (
                      <TableRow
                        key={trip.id}
                        className={cn(
                          'cursor-pointer',
                          selectedTripId === trip.id && 'bg-muted'
                        )}
                        onClick={() => setSelectedTripId(trip.id)}
                      >
                        <TableCell className="overflow-hidden font-medium">
                          <span className="truncate block">{trip.busCode}</span>
                        </TableCell>
                        <TableCell>{formatDateTime(trip.startedAt)}</TableCell>
                        <TableCell>
                          {trip.endedAt ? formatDateTime(trip.endedAt) : '-'}
                        </TableCell>
                        <TableCell className="text-right">{trip.playCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex md:w-3/5 flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              再生イベント
              {selectedTrip && (
                <span className="ml-2 font-normal text-muted-foreground">
                  ({selectedTrip.busCode} - {formatDateTime(selectedTrip.startedAt)})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {eventsError ? (
              <ErrorState retry={() => mutateEvents()} className="py-8" />
            ) : !selectedTripId ? (
              <Empty className="py-8">
                <EmptyMedia>
                  <FileText className="size-8" />
                </EmptyMedia>
                <EmptyTitle>運行を選択してください</EmptyTitle>
                <EmptyDescription>
                  左の一覧から運行を選択すると、再生イベントが表示されます
                </EmptyDescription>
              </Empty>
            ) : isLoadingEvents ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6" />
              </div>
            ) : playEvents?.length === 0 ? (
              <Empty className="py-8">
                <EmptyMedia>
                  <FileText className="size-8" />
                </EmptyMedia>
                <EmptyTitle>再生イベントがありません</EmptyTitle>
              </Empty>
            ) : (
              <div className="max-h-96 overflow-auto md:max-h-[600px]">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>コンテンツタイトル</TableHead>
                      <TableHead className="w-24">ステータス</TableHead>
                      <TableHead className="w-20">再生時刻</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playEvents?.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="overflow-hidden font-medium">
                          <span className="truncate block">{event.contentTitle}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(event.status)}>
                            {getStatusLabel(event.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatTime(event.playedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* システムイベントタイムライン */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              システムイベント
              {selectedTrip && (
                <span className="ml-2 font-normal text-muted-foreground">
                  (location_update 除く)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedTripId ? (
              <Empty className="py-6">
                <EmptyMedia><FileText className="size-6" /></EmptyMedia>
                <EmptyTitle>運行を選択してください</EmptyTitle>
              </Empty>
            ) : isLoadingSystemEvents ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5" />
              </div>
            ) : (
              <div className="max-h-64 overflow-auto px-4 py-2 space-y-0.5">
                {(systemEvents ?? [])
                  .filter((e) => e.event_type !== 'location_update')
                  .map((e) => {
                    const cfg = EVENT_CONFIG[e.event_type] ?? { label: e.event_type, icon: Activity, className: '' }
                    const Icon = cfg.icon
                    const meta = Object.entries(e.metadata)
                      .filter(([k]) => k !== 'lat' && k !== 'lng')
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(' / ')
                    return (
                      <div key={e.id} className="flex items-start gap-2 text-sm py-1 border-b border-border/40 last:border-0">
                        <span className="text-muted-foreground w-12 shrink-0 tabular-nums">
                          {formatTime(e.occurred_at)}
                        </span>
                        <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', cfg.className)} />
                        <span className="font-medium shrink-0">{cfg.label}</span>
                        {meta && (
                          <span className="text-muted-foreground truncate">{meta}</span>
                        )}
                      </div>
                    )
                  })}
                {(systemEvents ?? []).filter((e) => e.event_type !== 'location_update').length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    システムイベントがありません
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
