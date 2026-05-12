import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

    const { id } = await params
    const adminSupabase = createAdminClient()

    const { data: audioFile } = await adminSupabase
      .from('audio_files')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (!audioFile) {
      return NextResponse.json({ error: '音声ファイルが見つかりません' }, { status: 404 })
    }

    const { data: signed, error } = await adminSupabase.storage
      .from('audio-files')
      .createSignedUrl(audioFile.storage_path, 300)

    if (error || !signed) {
      return NextResponse.json({ error: '音声URLの生成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: signed.signedUrl })
  } catch (e) {
    console.error('GET /api/admin/audio/[id]:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
