'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Radio, ChevronRight } from 'lucide-react'
import type { ClientProgram } from '@/lib/schemas/client'

export default function ClientProgramSelectPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<ClientProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
        if (!res.ok) throw new Error('番組の取得に失敗しました')
        const data: ClientProgram[] = await res.json()
        setPrograms(data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '番組の取得に失敗しました')
      })
      .finally(() => setIsLoading(false))
  }, [router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-lg text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col p-6 dark:bg-background">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AutoDJ Radio</h1>
            <p className="text-lg text-muted-foreground">番組を選択してください</p>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Radio className="mb-4 h-16 w-16 text-muted-foreground" />
            <p className="text-xl text-muted-foreground">利用可能な番組がありません</p>
            <p className="mt-2 text-muted-foreground">管理画面で番組を有効にしてください</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <Card
                key={program.id}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-lg active:scale-[0.98]"
                onClick={() => router.push(`/client/confirm?programId=${program.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{program.name}</CardTitle>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardDescription className="text-base">タップして選択</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="px-3 py-1 text-base">
                      {program.items.length}件のコンテンツ
                    </Badge>
                    <Badge className="bg-brand-green px-3 py-1 text-base text-white">有効</Badge>
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
