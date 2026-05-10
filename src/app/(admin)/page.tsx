import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Radio, Bus, BarChart2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

async function getDashboardCounts() {
  const supabase = await createClient()
  const [contents, programs, buses, trips] = await Promise.all([
    supabase.from('contents').select('*', { count: 'exact', head: true }),
    supabase.from('radio_programs').select('*', { count: 'exact', head: true }),
    supabase.from('buses').select('*', { count: 'exact', head: true }),
    supabase.from('trips').select('*', { count: 'exact', head: true }),
  ])
  return {
    contents: contents.count ?? 0,
    programs: programs.count ?? 0,
    buses: buses.count ?? 0,
    trips: trips.count ?? 0,
  }
}

export default async function AdminDashboardPage() {
  const counts = await getDashboardCounts()

  const dashboardItems = [
    {
      title: 'コンテンツ一覧',
      description: '音声コンテンツの管理・編集',
      href: '/contents',
      icon: FileText,
      count: counts.contents,
    },
    {
      title: 'ラジオ番組',
      description: '番組の構成と配置設定',
      href: '/programs',
      icon: Radio,
      count: counts.programs,
    },
    {
      title: 'バス管理',
      description: '車両とデバイスの管理',
      href: '/buses',
      icon: Bus,
      count: counts.buses,
    },
    {
      title: '再生ログ',
      description: '運行・再生履歴の確認',
      href: '/logs',
      icon: BarChart2,
      count: counts.trips,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground">
          AutoDJ Radio 管理システムへようこそ
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {item.title}
                </CardTitle>
                <item.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.count}</div>
                <CardDescription className="text-xs">
                  {item.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
