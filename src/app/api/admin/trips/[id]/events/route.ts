import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { id } = await params

    const { data, error } = await supabase
      .from('trip_playback_events')
      .select('*, radio_program_items(contents(title))')
      .eq('trip_id', id)
      .order('played_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    type ItemWithContent = { contents: { title: string } | null } | null
    const events = (data ?? []).map((ev) => {
      const item = ev.radio_program_items as ItemWithContent
      const contentTitle = item?.contents?.title ?? '不明'
      return {
        id: ev.id,
        contentTitle,
        status: ev.status as 'completed' | 'skipped' | 'error',
        playedAt: ev.played_at,
      }
    })

    return NextResponse.json(events)
  } catch (e) {
    console.error('GET /api/admin/trips/[id]/events:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
