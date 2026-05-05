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
import { MOCK_PROGRAMS } from '@/lib/stubs'
import type { GpsStatus, ServerStatus, Program } from '@/lib/types'

function StatusIndicator({
  status,
  label,
  type,
}: {
  status: 'ok' | 'warning' | 'error'
  label: string
  type: 'gps' | 'server'
}) {
  const colorClass = {
    ok: 'bg-brand-green',
    warning: 'bg-brand-warning',
    error: 'bg-brand-red',
  }[status]

  const Icon = type === 'gps' ? Navigation : Wifi

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">
          {type === 'gps' ? 'GPS' : 'サーバー通信'}
        </p>
        <p className="text-lg font-medium text-foreground">{label}</p>
      </div>
    </div>
  )
}

function ConfirmPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const programId = searchParams.get('programId')

  const [program, setProgram] = useState<Program | null>(null)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('inactive')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('disconnected')

  useEffect(() => {
    if (programId) {
      const found = MOCK_PROGRAMS.find((p) => p.id === programId)
      setProgram(found ?? null)
    }
  }, [programId])

  // GPS状態のシミュレーション
  useEffect(() => {
    const timer = setTimeout(() => {
      setGpsStatus('active')
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // サーバー接続状態のシミュレーション
  useEffect(() => {
    const timer = setTimeout(() => {
      setServerStatus('connected')
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const gpsStatusInfo = {
    active: { status: 'ok' as const, label: '受信中' },
    inactive: { status: 'error' as const, label: '未受信' },
    'low-accuracy': { status: 'warning' as const, label: '精度低下' },
  }[gpsStatus]

  const serverStatusInfo = {
    connected: { status: 'ok' as const, label: '接続中' },
    disconnected: { status: 'error' as const, label: '切断' },
  }[serverStatus]

  const canStart = gpsStatus === 'active' && serverStatus === 'connected'

  const handleStart = () => {
    if (canStart && programId) {
      router.push(`/client/play?programId=${programId}`)
    }
  }

  if (!program) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

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
        {/* ステータスインジケーター */}
        <div className="grid gap-4 md:grid-cols-2">
          <StatusIndicator
            type="gps"
            status={gpsStatusInfo.status}
            label={gpsStatusInfo.label}
          />
          <StatusIndicator
            type="server"
            status={serverStatusInfo.status}
            label={serverStatusInfo.label}
          />
        </div>

        {/* 警告メッセージ */}
        {!canStart && (
          <div className="rounded-lg border border-brand-warning bg-brand-warning/10 p-4">
            <p className="text-lg font-medium text-brand-warning">
              GPS・サーバー通信が正常になるまでお待ちください
            </p>
          </div>
        )}

        {/* コンテンツ一覧 */}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {program.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-lg font-medium">
                        {item.locationName}
                      </TableCell>
                      <TableCell className="text-lg text-muted-foreground">
                        {item.contentTitle}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 開始ボタン */}
      <footer className="mt-6 pt-6 border-t">
        <Button
          size="lg"
          className="w-full h-16 text-xl"
          disabled={!canStart}
          onClick={handleStart}
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
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center dark:bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    }>
      <ConfirmPageContent />
    </Suspense>
  )
}
