import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVertexAccessToken, buildVertexUrl } from '@/lib/vertex-ai'
import { buildScriptifyPrompt } from '@/prompts/scriptify'
import { ContentMetadataSchema } from '@/lib/schemas/content'

const RequestSchema = z.object({
  sourceText: z.string().min(1, '元テキストを入力してください').max(20000),
  contentId: z.string().uuid().optional(),
  title: z.string().optional(),
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

    const { sourceText, contentId, title } = parsed.data
    const prompt = buildScriptifyPrompt({ sourceText, title })
    const model = process.env.GEMINI_SCRIPTIFY_MODEL ?? 'gemini-2.5-flash'

    const accessToken = await getVertexAccessToken()
    const url = buildVertexUrl(model)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('Gemini Flash scriptify error:', res.status, detail)
      return NextResponse.json({ error: '台本生成に失敗しました。しばらくしてから再度お試しください。' }, { status: 502 })
    }

    const json = await res.json() as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> }
      }>
    }

    const scriptText = json.candidates[0]?.content?.parts[0]?.text ?? ''
    if (!scriptText) {
      return NextResponse.json({ error: '台本の生成結果が空でした' }, { status: 502 })
    }

    const trimmed = scriptText.trim()

    // contentId が渡された場合は script_versions に保存（最大3件）
    if (contentId) {
      const versionId = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      const adminClient = createAdminClient()

      const { data: contentRow } = await adminClient
        .from('contents')
        .select('metadata')
        .eq('id', contentId)
        .single()

      if (contentRow) {
        const meta = ContentMetadataSchema.parse(contentRow.metadata ?? {})
        const newVersion = { id: versionId, text: trimmed, model, createdAt }
        const updatedVersions = [newVersion, ...meta.script_versions].slice(0, 3)

        await adminClient
          .from('contents')
          .update({
            metadata: {
              ...contentRow.metadata as Record<string, unknown>,
              script_versions: updatedVersions,
            },
          })
          .eq('id', contentId)

        return NextResponse.json({
          scriptText: trimmed,
          version: { id: versionId, model, createdAt },
        })
      }
    }

    return NextResponse.json({ scriptText: trimmed })
  } catch (e) {
    console.error('scriptify route error:', e)
    return NextResponse.json({ error: '台本生成中にエラーが発生しました' }, { status: 500 })
  }
}
