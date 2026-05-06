'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { ArrowLeft, Play, MapPin, Wifi, Navigation } from 'lucide-react'
import type { ClientProgram } from '@/lib/schemas/client'
import type { GpsStatus, ServerStatus } from '@/lib/types'

function StatusCard({
  type,
  status,
  label,
}: {
  type: 'gps' | 'server'
  status: 'ok' | 'warning' | 'error'
  label: string
}) {
  const colorClass = { ok: 'bg-brand-green', warning: 'bg-brand-warning', error: 'bg-brand-red' }[status]
  const Icon = type === 'gps' ? Navigation : Wifi
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{type === 'gps' ? 'GPS' : 'サーバー通信'}</p>
        <p className="text-lg font-medium text-foreground">{label}</p>
      </div>
    </div>
  )
}

function ConfirmPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const programId = searchParams.get('programId')

  const [program, setProgram] = useState<ClientProgram | null>(null)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('inactive')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('disconnected')
  const [isLoading, setIsLoading] = useState(true)

  // 番組データ取得 + サーバー接続確認
  useEffect(() => {
    if (!programId) {
      router.replace('/client')
      return
    }

    const token = localStorage.getItem('deviceToken')
    if (!token) {
      router.replace('/client/setup')
      return
    }

    fetch('/api/client/program', { headers: { 'X-Device-Token': token } })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace('/client/setup')
          return
        }
        if (!res.ok) throw new Error()
        const data: ClientProgram[] = await res.json()
        const found = data.find((p) => p.id === programId)
        if (!found) {
          router.replace('/client')
          return
        }
        setProgram(found)
        setServerStatus('connected')
      })
      .catch(() => setServerStatus('disconnected'))
      .finally(() => setIsLoading(false))
  }, [programId, router])

  // GPS 状態を実際に確認（初期値はすでに 'inactive'）
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsStatus(pos.coords.accuracy > 100 ? 'low-accuracy' : 'active'),
      () => setGpsStatus('inactive'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const gpsInfo = {
    active: { status: 'ok' as const, label: '受信中' },
    inactive: { status: 'error' as const, label: '未受信' },
    'low-accuracy': { status: 'warning' as const, label: '精度低下' },
  }[gpsStatus]

  const serverInfo = {
    connected: { status: 'ok' as const, label: '接続中' },
    disconnected: { status: 'error' as const, label: '切断' },
  }[serverStatus]

  const canStart = gpsStatus === 'active' && serverStatus === 'connected'

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!program) return null

  return (
    <div className="flex min-h-screen flex-col p-6 dark:bg-background">
      <header className="mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="h-12 w-12">
            <Link href="/client">
              <ArrowLeft className="h-6 w-6" />
              <span className="sr-only">戻る</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{program.name}</h1>
            <p className="text-lg text-muted-foreground">番組確認</p>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <StatusCard type="gps" status={gpsInfo.status} label={gpsInfo.label} />
          <StatusCard type="server" status={serverInfo.status} label={serverInfo.label} />
        </div>

        {!canStart && (
          <div className="rounded-lg border border-brand-warning bg-brand-warning/10 p-4">
            <p className="text-lg font-medium text-brand-warning">
              GPS・サーバー通信が正常になるまでお待ちください
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPin className="h-5 w-5" />
              登録コンテンツ一覧（{program.items.length}件）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {program.items.length === 0 ? (
              <p className="py-8 text-center text-lg text-muted-foreground">
                コンテンツが登録されていません
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-base">位置名称</TableHead>
                    <TableHead className="text-base">コンテンツ</TableHead>
                    <TableHead className="text-base">音声</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {program.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-lg font-medium">
                        {item.displayName ?? '未設定'}
                      </TableCell>
                      <TableCell className="text-lg text-muted-foreground">
                        {item.contentTitle}
                      </TableCell>
                      <TableCell>
                        {item.audioFileId ? (
                          <Badge className="bg-brand-green text-white">あり</Badge>
                        ) : (
                          <Badge variant="secondary">なし</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="mt-6 border-t pt-6">
        <Button
          size="lg"
          className="h-16 w-full text-xl"
          disabled={!canStart}
          onClick={() => router.push(`/client/play?programId=${programId}`)}
        >
          <Play className="mr-3 h-6 w-6" />
          再生開始
        </Button>
      </footer>
    </div>
  )
}

export default function ClientConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center dark:bg-background">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <ConfirmPageContent />
    </Suspense>
  )
}
