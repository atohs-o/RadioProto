import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../_lib/device-auth'
import { PlaybackEventBodySchema } from '@/lib/schemas/client'

export async function POST(request: NextRequest) {
  const device = await resolveDevice(request)
  if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式エラー' }, { status: 400 })
  }

  const parsed = PlaybackEventBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'バリデーションエラー' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('trip_playback_events').insert({
    trip_id: parsed.data.tripId,
    radio_program_item_id: parsed.data.radioProgramItemId,
    status: parsed.data.status,
    duration_seconds: parsed.data.durationSeconds ?? null,
  })

  if (error) {
    console.error('再生イベント記録エラー:', error)
    return NextResponse.json({ error: '再生記録に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
