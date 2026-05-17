import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../_lib/device-auth'
import { ClientProgramSummarySchema } from '@/lib/schemas/client'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const device = await resolveDevice(request)
    if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: programs, error } = await supabase
      .from('radio_programs')
      .select('id, name, radio_program_items(id)')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('番組一覧取得エラー:', error)
      return NextResponse.json({ error: '番組一覧取得エラー' }, { status: 500 })
    }

    const mapped = (programs ?? []).map((prog) => ({
      id: prog.id,
      name: prog.name,
      itemCount: (prog.radio_program_items as { id: string }[]).length,
    }))

    const result = z.array(ClientProgramSummarySchema).parse(mapped)
    return NextResponse.json(result)
  } catch (e) {
    console.error('GET /api/client/programs:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
