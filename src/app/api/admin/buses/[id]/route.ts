import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PatchBusSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('disable') }),
  z.object({
    action: z.literal('update'),
    plateNumber: z.string().nullable().optional(),
    currentProgramId: z.string().uuid().nullable().optional(),
  }),
])

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

    const { plateNumber, currentProgramId } = parsed.data

    const updates: {
      plate_number?: string | null
      current_program_id?: string | null
    } = {}
    if (plateNumber !== undefined) updates.plate_number = plateNumber
    if (currentProgramId !== undefined) updates.current_program_id = currentProgramId

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true })
    }

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
