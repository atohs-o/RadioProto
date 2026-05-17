import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../_lib/device-auth'
import { ClientBusStateSchema, PatchBusBodySchema } from '@/lib/schemas/client'

export async function GET(request: NextRequest) {
  try {
    const device = await resolveDevice(request)
    if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: bus, error: busError } = await supabase
      .from('buses')
      .select('current_program_id, manual_program_id, is_manual_override')
      .eq('id', device.busId)
      .single()

    if (busError || !bus) {
      console.error('バス情報取得エラー:', busError)
      return NextResponse.json({ error: 'バス情報取得エラー' }, { status: 500 })
    }

    const activeId = bus.is_manual_override ? bus.manual_program_id : bus.current_program_id

    let currentProgramName: string | null = null
    if (activeId) {
      const { data: prog } = await supabase
        .from('radio_programs')
        .select('name')
        .eq('id', activeId)
        .single()
      currentProgramName = prog?.name ?? null
    }

    const result = ClientBusStateSchema.parse({
      isManualOverride: bus.is_manual_override,
      currentProgramId: activeId,
      manualProgramId: bus.manual_program_id,
      currentProgramName,
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('GET /api/client/bus:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const device = await resolveDevice(request)
    if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

    const body: unknown = await request.json()
    const parsed = PatchBusBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'リクエスト形式エラー' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (parsed.data.action === 'setManual') {
      const { error } = await supabase
        .from('buses')
        .update({ manual_program_id: parsed.data.programId, is_manual_override: true })
        .eq('id', device.busId)
      if (error) {
        console.error('manual set エラー:', error)
        return NextResponse.json({ error: 'DB更新エラー' }, { status: 500 })
      }
    } else {
      const { error } = await supabase
        .from('buses')
        .update({ manual_program_id: null, is_manual_override: false })
        .eq('id', device.busId)
      if (error) {
        console.error('manual clear エラー:', error)
        return NextResponse.json({ error: 'DB更新エラー' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PATCH /api/client/bus:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
