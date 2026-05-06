import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../_lib/device-auth'
import { ClientProgramSchema } from '@/lib/schemas/client'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const device = await resolveDevice(request)
  if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: assignments, error: assignError } = await supabase
    .from('bus_radio_assignments')
    .select('radio_program_id')
    .eq('bus_id', device.busId)
    .eq('is_active', true)

  if (assignError) {
    console.error('番組割り当て取得エラー:', assignError)
    return NextResponse.json({ error: '番組取得エラー' }, { status: 500 })
  }

  if (!assignments || assignments.length === 0) {
    return NextResponse.json([])
  }

  const programIds = assignments.map((a) => a.radio_program_id)

  const programs = await Promise.all(
    programIds.map(async (programId) => {
      const { data: prog } = await supabase
        .from('radio_programs')
        .select('id, name')
        .eq('id', programId)
        .eq('is_active', true)
        .single()

      if (!prog) return null

      const { data: items } = await supabase
        .from('radio_program_items')
        .select(
          'id, lat, lng, display_name, sequence, audio_file_id, contents!inner(title), audio_files(duration_seconds)',
        )
        .eq('radio_program_id', programId)
        .order('sequence', { ascending: true, nullsFirst: false })

      const mappedItems = (items ?? []).map((item) => {
        const content = item.contents as unknown as { title: string }
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
        }
      })

      return { id: prog.id, name: prog.name, items: mappedItems }
    }),
  )

  const valid = programs.filter(Boolean)
  const parsed = z.array(ClientProgramSchema).parse(valid)
  return NextResponse.json(parsed)
}
