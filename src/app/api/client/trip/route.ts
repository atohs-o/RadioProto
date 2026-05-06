import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../_lib/device-auth'
import { StartTripBodySchema, EndTripBodySchema } from '@/lib/schemas/client'

export async function POST(request: NextRequest) {
  const device = await resolveDevice(request)
  if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式エラー' }, { status: 400 })
  }

  const parsed = StartTripBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'バリデーションエラー' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      bus_id: device.busId,
      device_id: device.deviceId,
      radio_program_id: parsed.data.radioProgramId,
    })
    .select('id')
    .single()

  if (error || !trip) {
    console.error('運行開始エラー:', error)
    return NextResponse.json({ error: '運行開始に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ tripId: trip.id })
}

export async function PATCH(request: NextRequest) {
  const device = await resolveDevice(request)
  if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式エラー' }, { status: 400 })
  }

  const parsed = EndTripBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'バリデーションエラー' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('trips')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', parsed.data.tripId)
    .eq('bus_id', device.busId) // バスに紐づくtripのみ更新可

  if (error) {
    console.error('運行終了エラー:', error)
    return NextResponse.json({ error: '運行終了に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
