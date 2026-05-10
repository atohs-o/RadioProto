import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { id } = await params
    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('devices')
      .update({ is_active: false })
      .eq('bus_id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PATCH /api/admin/buses/[id]:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
