import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('radio_programs')
      .select('id, name, is_active')
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const programs = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.is_active,
    }))

    return NextResponse.json(programs)
  } catch (e) {
    console.error('GET /api/admin/programs:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
