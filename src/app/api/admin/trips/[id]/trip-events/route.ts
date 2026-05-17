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
      .from('trip_events')
      .select('id, event_type, metadata, occurred_at')
      .eq('trip_id', id)
      .order('occurred_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('GET /api/admin/trips/[id]/trip-events:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
