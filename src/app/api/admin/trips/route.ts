import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const date = searchParams.get('date')
    const busCode = searchParams.get('busCode')

    let query = supabase
      .from('trips')
      .select('*, buses!inner(bus_code), trip_playback_events(id)')
      .order('started_at', { ascending: false })
      .limit(200)

    if (date) {
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      query = query
        .gte('started_at', `${date}T00:00:00.000Z`)
        .lt('started_at', nextDay.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    }

    if (busCode) {
      query = query.eq('buses.bus_code', busCode)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const trips = (data ?? []).map((trip) => {
      const bus = trip.buses as { bus_code: string } | null
      const events = Array.isArray(trip.trip_playback_events) ? trip.trip_playback_events : []
      return {
        id: trip.id,
        busCode: bus?.bus_code ?? '',
        startedAt: trip.started_at,
        endedAt: trip.ended_at ?? undefined,
        playCount: events.length,
      }
    })

    return NextResponse.json(trips)
  } catch (e) {
    console.error('GET /api/admin/trips:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
