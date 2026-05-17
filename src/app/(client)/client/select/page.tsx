'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { ClientProgramSummary, ClientBusState } from '@/lib/schemas/client'

export default function SelectPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<ClientProgramSummary[]>([])
  const [currentProgramId, setCurrentProgramId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSelecting, setIsSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('deviceToken')
    if (!token) {
      router.replace('/client/setup')
      return
    }

    try {
      const [progsRes, busRes] = await Promise.all([
        fetch('/api/client/programs', { headers: { 'X-Device-Token': token } }),
        fetch('/api/client/bus', { headers: { 'X-Device-Token': token } }),
      ])

      if (progsRes.status === 401 || busRes.status === 401) {
        router.replace('/client/setup')
        return
      }

      if (!progsRes.ok || !busRes.ok) throw new Error('データ取得に失敗しました')

      const [progsData, busData]: [ClientProgramSummary[], ClientBusState] = await Promise.all([
        progsRes.json(),
        busRes.json(),
      ])

      setPrograms(progsData)
      setCurrentProgramId(busData.currentProgramId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データ取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSelectProgram = useCallback(
    async (programId: string) => {
      const token = localStorage.getItem('deviceToken')
      if (!token || isSelecting) return

      setIsSelecting(programId)
      try {
        await fetch('/api/client/bus', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
          body: JSON.stringify({ action: 'setManual', programId }),
        })
        router.replace('/client/wait')
      } catch {
        setIsSelecting(null)
      }
    },
    [isSelecting, router],
  )

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 dark:bg-background">
        <p className="text-lg text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col p-6 dark:bg-background">
      <header className="mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => router.push('/client/wait')}
          >
            <ArrowLeft className="h-6 w-6" />
            <span className="sr-only">戻る</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">番組選択</h1>
            <p className="text-lg text-muted-foreground">使用する番組を選んでください</p>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-xl text-muted-foreground">利用可能な番組がありません</p>
            <p className="mt-2 text-muted-foreground">管理画面で番組を有効にしてください</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <Card
                key={program.id}
                className={`cursor-pointer transition-all hover:border-primary hover:shadow-lg active:scale-[0.98] ${
                  isSelecting === program.id ? 'opacity-60' : ''
                }`}
                onClick={() => handleSelectProgram(program.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{program.name}</CardTitle>
                    {isSelecting === program.id ? (
                      <Spinner className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="px-3 py-1 text-base">
                      {program.itemCount}件のコンテンツ
                    </Badge>
                    {currentProgramId === program.id && (
                      <Badge className="bg-brand-green px-3 py-1 text-base text-white">
                        選択中
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
