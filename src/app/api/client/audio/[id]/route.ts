import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDevice } from '../../_lib/device-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const device = await resolveDevice(request)
  if (!device) return NextResponse.json({ error: '認証エラー' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: audioFile } = await supabase
    .from('audio_files')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (!audioFile) {
    return NextResponse.json({ error: '音声ファイルが見つかりません' }, { status: 404 })
  }

  // 5分有効の署名付きURL（キャッシュ前にバイナリを取得するための短命URL）
  const { data: signed, error } = await supabase.storage
    .from('audio-files')
    .createSignedUrl(audioFile.storage_path, 300)

  if (error || !signed) {
    console.error('署名付きURL生成エラー:', error)
    return NextResponse.json({ error: '音声URLの生成に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signed.signedUrl })
}
