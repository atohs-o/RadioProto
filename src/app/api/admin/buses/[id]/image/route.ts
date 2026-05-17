import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const AllowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
const MaxBytes = 5 * 1024 * 1024

const ExtByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

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

    const { data: bus, error } = await adminClient
      .from('buses')
      .select('image_url')
      .eq('id', id)
      .single()

    if (error || !bus) return NextResponse.json({ error: 'バスが見つかりません' }, { status: 404 })
    if (!bus.image_url) return NextResponse.json({ error: '画像が未登録です' }, { status: 404 })

    const { data: signed, error: signError } = await adminClient.storage
      .from('buses')
      .createSignedUrl(bus.image_url, 3600)

    if (signError || !signed) {
      return NextResponse.json({ error: '署名付きURL生成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: signed.signedUrl })
  } catch (e) {
    console.error('GET /api/admin/buses/[id]/image:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { id } = await params

    const formData = await req.formData()
    const file = formData.get('image')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '画像ファイルが必要です' }, { status: 400 })
    }
    if (!(AllowedMimeTypes as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: 'JPEG / PNG / WebP のみ対応しています' }, { status: 400 })
    }
    if (file.size > MaxBytes) {
      return NextResponse.json({ error: '5MB 以下の画像を選択してください' }, { status: 400 })
    }

    const ext = ExtByMime[file.type] ?? 'jpg'
    const storagePath = `${id}/image.${ext}`
    const buffer = await file.arrayBuffer()

    const adminClient = createAdminClient()

    const { error: uploadError } = await adminClient.storage
      .from('buses')
      .upload(storagePath, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 })
    }

    const { error: updateError } = await adminClient
      .from('buses')
      .update({ image_url: storagePath })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: 'DB更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ imageUrl: storagePath })
  } catch (e) {
    console.error('PUT /api/admin/buses/[id]/image:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
