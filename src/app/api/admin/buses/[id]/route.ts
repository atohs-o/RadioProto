import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PatchBusSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('disable') }),
  z.object({ action: z.literal('enable') }),
  z.object({
    action: z.literal('update'),
    busName: z.string().min(1).optional(),
    plateNumber: z.string().nullable().optional(),
    currentProgramId: z.string().uuid().nullable().optional(),
  }),
])

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { id } = await params
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('buses')
      .select('*, devices(id, token, is_active, last_seen_at)')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'バスが見つかりません' }, { status: 404 })

    const devices = Array.isArray(data.devices) ? data.devices : []
    const activeDevice = devices.find((d: { is_active: boolean }) => d.is_active) ?? devices[0] ?? null

    return NextResponse.json({
      id: data.id,
      busCode: data.bus_code,
      busName: data.name ?? '',
      plateNumber: data.plate_number ?? null,
      imageUrl: data.image_url ?? null,
      currentProgramId: data.current_program_id ?? null,
      isManualOverride: data.is_manual_override,
      deviceToken: activeDevice?.token ?? '',
      lastConnectedAt: activeDevice?.last_seen_at ?? undefined,
      enabled: devices.some((d: { is_active: boolean }) => d.is_active),
    })
  } catch (e) {
    console.error('GET /api/admin/buses/[id]:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { id } = await params
    const rawBody = await req.text()
    const parsed = PatchBusSchema.safeParse(rawBody ? JSON.parse(rawBody) : { action: 'disable' })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力が不正です' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    if (parsed.data.action === 'disable') {
      const { error } = await adminClient
        .from('devices')
        .update({ is_active: false })
        .eq('bus_id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (parsed.data.action === 'enable') {
      const { data: latest } = await adminClient
        .from('devices')
        .select('id')
        .eq('bus_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!latest) return NextResponse.json({ error: 'デバイスが見つかりません' }, { status: 404 })

      const { error } = await adminClient
        .from('devices')
        .update({ is_active: true })
        .eq('id', latest.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    const { busName, plateNumber, currentProgramId } = parsed.data
    const updates: {
      name?: string
      plate_number?: string | null
      current_program_id?: string | null
    } = {}
    if (busName !== undefined) updates.name = busName
    if (plateNumber !== undefined) updates.plate_number = plateNumber
    if (currentProgramId !== undefined) updates.current_program_id = currentProgramId

    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

    const { error } = await adminClient
      .from('buses')
      .update(updates)
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PATCH /api/admin/buses/[id]:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
