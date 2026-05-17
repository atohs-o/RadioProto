import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../_lib/device-auth'
import { ClientProgramSchema } from '@/lib/schemas/client'
import { z } from 'zod'

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
      return NextResponse.json({ error: '番組取得エラー' }, { status: 500 })
    }

    const programId = bus.is_manual_override
      ? bus.manual_program_id
      : bus.current_program_id

    if (!programId) return NextResponse.json([])

    const { data: prog } = await supabase
      .from('radio_programs')
      .select('id, name')
      .eq('id', programId)
      .eq('is_active', true)
      .single()

    if (!prog) return NextResponse.json([])

    const { data: items } = await supabase
      .from('radio_program_items')
      .select(
        'id, lat, lng, display_name, sequence, audio_file_id, contents!inner(title, script), audio_files(duration_seconds)',
      )
      .eq('radio_program_id', programId)
      .order('sequence', { ascending: true, nullsFirst: false })

    const mappedItems = (items ?? []).map((item) => {
      const content = item.contents as unknown as { title: string; script: string | null }
      const audioFile = item.audio_files as unknown as { duration_seconds: number | null } | null
      return {
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        displayName: item.display_name,
        contentTitle: content.title,
        audioFileId: item.audio_file_id,
        durationSeconds: audioFile?.duration_seconds ?? null,
        sequence: item.sequence,
        script: content.script,
      }
    })

    const { data: shapeRows } = await supabase
      .from('radio_program_shapes')
      .select('shape_id, points')
      .eq('program_id', programId)

    const ShapePointSchema = z.object({ lat: z.number(), lng: z.number() })
    const shapes = (shapeRows ?? []).map((s) => ({
      shapeId: s.shape_id,
      points: z.array(ShapePointSchema).catch([]).parse(s.points),
    }))

    const parsed = z.array(ClientProgramSchema).parse([{ id: prog.id, name: prog.name, items: mappedItems, shapes }])
    return NextResponse.json(parsed)
  } catch (e) {
    console.error('GET /api/client/program:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
