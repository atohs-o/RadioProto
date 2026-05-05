import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { synthesize } from '@/lib/tts'

// WARN: Vercel Hobby plan caps API routes at 10s. If TTS latency exceeds this,
// move synthesize() call to a Supabase Edge Function. See plan §タイムアウトリスク.
export const maxDuration = 60

const RequestSchema = z.object({
  contentId: z.string().uuid('コンテンツIDが不正です'),
  scriptText: z.string().min(1, '台本テキストを入力してください').max(4000),
})

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body: unknown = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力が不正です' }, { status: 400 })
    }

    const { contentId, scriptText } = parsed.data
    const adminClient = createAdminClient()

    // audio_status を 'generating' に更新
    const { data: contentRow, error: contentError } = await adminClient
      .from('contents')
      .select('metadata')
      .eq('id', contentId)
      .single()

    if (contentError || !contentRow) {
      return NextResponse.json({ error: 'コンテンツが見つかりません' }, { status: 404 })
    }

    const currentMeta = (contentRow.metadata ?? {}) as Record<string, unknown>
    await adminClient
      .from('contents')
      .update({ metadata: { ...currentMeta, audio_status: 'generating' } })
      .eq('id', contentId)

    // TTS 音声生成
    const { wavBuffer, durationSeconds } = await synthesize(scriptText)

    // Supabase Storage にアップロード
    const audioFileId = crypto.randomUUID()
    const storagePath = `${contentId}/${audioFileId}.wav`
    const ttsModel = process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-tts'

    const { error: uploadError } = await adminClient.storage
      .from('audio-files')
      .upload(storagePath, wavBuffer, {
        contentType: 'audio/wav',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      await adminClient
        .from('contents')
        .update({ metadata: { ...currentMeta, audio_status: 'error' } })
        .eq('id', contentId)
      return NextResponse.json({ error: '音声ファイルのアップロードに失敗しました' }, { status: 500 })
    }

    // audio_files テーブルにレコード追加
    const { error: insertError } = await adminClient
      .from('audio_files')
      .insert({
        id: audioFileId,
        content_id: contentId,
        storage_path: storagePath,
        duration_seconds: durationSeconds,
        file_size_bytes: wavBuffer.length,
        tts_model: ttsModel,
        metadata: { tts_model: ttsModel },
      })

    if (insertError) {
      console.error('audio_files insert error:', insertError)
      await adminClient
        .from('contents')
        .update({ metadata: { ...currentMeta, audio_status: 'error' } })
        .eq('id', contentId)
      return NextResponse.json({ error: '音声ファイル情報の保存に失敗しました' }, { status: 500 })
    }

    // audio_status を 'generated' に更新
    await adminClient
      .from('contents')
      .update({ metadata: { ...currentMeta, audio_status: 'generated' } })
      .eq('id', contentId)

    // 署名付きURL生成（1時間有効）
    const { data: signedData, error: signedError } = await adminClient.storage
      .from('audio-files')
      .createSignedUrl(storagePath, 3600)

    if (signedError || !signedData?.signedUrl) {
      console.error('Signed URL error:', signedError)
      return NextResponse.json({ error: '音声URLの生成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({
      audioUrl: signedData.signedUrl,
      durationSeconds,
    })
  } catch (e) {
    console.error('tts route error:', e)
    return NextResponse.json({ error: '音声生成中にエラーが発生しました' }, { status: 500 })
  }
}
