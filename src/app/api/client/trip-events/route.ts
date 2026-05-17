import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../_lib/device-auth'
import type { Json } from '@/types/database.types'

const BodySchema = z.object({
  tripId: z.string().uuid(),
  eventType: z.enum([
    'gps_lost', 'gps_recovered', 'server_lost', 'server_recovered',
    'auth_failed', 'trip_started', 'trip_ended', 'abnormal_ended',
    'timeout_ended', 'sequence_advanced', 'playback_error', 'location_update',
  ] as const),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(request: NextRequest) {
  try {
    const device = await resolveDevice(request)
    if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

    const parsed = BodySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: '不正なリクエスト' }, { status: 400 })

    const { tripId, eventType, metadata } = parsed.data
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('trip_events')
      .insert({ trip_id: tripId, event_type: eventType, metadata: metadata as unknown as Json })

    if (error) {
      console.error('POST /api/client/trip-events:', error)
      return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/client/trip-events:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
