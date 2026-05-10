import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CreateBusSchema = z.object({
  busCode: z.string().min(1, 'バスコードを入力してください'),
  busName: z.string().min(1, 'バス名を入力してください'),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { data, error } = await supabase
      .from('buses')
      .select('*, devices(id, token, is_active, last_seen_at)')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const buses = (data ?? []).map((bus) => {
      const devices = Array.isArray(bus.devices) ? bus.devices : []
      const activeDevice = devices.find((d: { is_active: boolean }) => d.is_active) ?? devices[0] ?? null
      return {
        id: bus.id,
        busCode: bus.bus_code,
        busName: bus.name ?? '',
        deviceToken: activeDevice?.token ?? '',
        lastConnectedAt: activeDevice?.last_seen_at ?? undefined,
        enabled: devices.some((d: { is_active: boolean }) => d.is_active),
      }
    })

    return NextResponse.json(buses)
  } catch (e) {
    console.error('GET /api/admin/buses:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body: unknown = await req.json()
    const parsed = CreateBusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力が不正です' }, { status: 400 })
    }

    const { busCode, busName } = parsed.data
    const adminClient = createAdminClient()

    const { data: bus, error: busError } = await adminClient
      .from('buses')
      .insert({ bus_code: busCode, name: busName })
      .select()
      .single()

    if (busError || !bus) {
      return NextResponse.json({ error: busError?.message ?? 'バスの作成に失敗しました' }, { status: 500 })
    }

    const token = 'tok_' + crypto.randomUUID().replace(/-/g, '')

    const { error: deviceError } = await adminClient
      .from('devices')
      .insert({ bus_id: bus.id, token, is_active: true })

    if (deviceError) {
      await adminClient.from('buses').delete().eq('id', bus.id)
      return NextResponse.json({ error: 'デバイストークンの作成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({
      id: bus.id,
      busCode: bus.bus_code,
      busName: bus.name ?? '',
      deviceToken: token,
      enabled: true,
    })
  } catch (e) {
    console.error('POST /api/admin/buses:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
