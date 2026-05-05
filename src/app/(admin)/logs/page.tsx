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
import { getTrips, getPlayEventsByTripId, getBuses } from '@/lib/stubs'
import type { Trip, PlayEvent, Bus } from '@/types'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    case 'completed':
      return 'default'
    case 'skipped':
      return 'secondary'
    case 'error':
      return 'destructive'
    default:
      return 'default'
  }
}

function getStatusLabel(status: PlayEvent['status']): string {
  switch (status) {
    case 'completed':
      return '完了'
    case 'skipped':
      return 'スキップ'
    case 'error':
      return 'エラー'
    default:
      return status
  }
}

export default function LogsPage() {
  const [dateFilter, setDateFilter] = useState('')
  const [busFilter, setBusFilter] = useState<string>('all')
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

  const { data: buses } = useSWR<Bus[]>('buses', getBuses)
  const { data: trips, isLoading: isLoadingTrips } = useSWR<Trip[]>(
    ['trips', dateFilter, busFilter],
    () => getTrips({
      date: dateFilter || undefined,
      busCode: busFilter !== 'all' ? busFilter : undefined,
    })
  )
  const { data: playEvents, isLoading: isLoadingEvents } = useSWR<PlayEvent[]>(
    selectedTripId ? ['playEvents', selectedTripId] : null,
    () => selectedTripId ? getPlayEventsByTripId(selectedTripId) : Promise.resolve([])
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

      {/* Filters */}
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

      {/* Split Layout: md以上で左40%/右60%、md未満で上下積み */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Left: Trip List (40%) */}
        <Card className="md:w-2/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">運行一覧</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingTrips ? (
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>バス</TableHead>
                      <TableHead>運行開始</TableHead>
                      <TableHead>運行終了</TableHead>
                      <TableHead className="text-right">再生数</TableHead>
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
                        <TableCell className="font-medium">{trip.busCode}</TableCell>
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

        {/* Right: Play Events (60%) */}
        <Card className="md:w-3/5">
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
            {!selectedTripId ? (
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>コンテンツタイトル</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>再生時刻</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playEvents?.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">
                          {event.contentTitle}
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
      </div>
    </div>
  )
}
