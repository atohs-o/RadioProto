import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../_lib/device-auth'
import { LocationBodySchema } from '@/lib/schemas/client'

export async function POST(request: NextRequest) {
  const device = await resolveDevice(request)
  if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式エラー' }, { status: 400 })
  }

  const parsed = LocationBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'バリデーションエラー' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('vehicle_location_logs').insert({
    bus_id: device.busId,
    trip_id: parsed.data.tripId,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    heading: parsed.data.heading ?? null,
    speed_kmh: parsed.data.speedKmh ?? null,
  })

  if (error) {
    console.error('位置ログエラー:', error)
    return NextResponse.json({ error: '位置記録に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
