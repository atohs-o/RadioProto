import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getVertexAccessToken, buildVertexUrl } from '@/lib/vertex-ai'
import { buildScriptifyPrompt } from '@/prompts/scriptify'

const RequestSchema = z.object({
  sourceText: z.string().min(1, '元テキストを入力してください').max(20000),
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

    const { sourceText } = parsed.data
    const prompt = buildScriptifyPrompt({ sourceText })
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

    return NextResponse.json({ scriptText: scriptText.trim() })
  } catch (e) {
    console.error('scriptify route error:', e)
    return NextResponse.json({ error: '台本生成中にエラーが発生しました' }, { status: 500 })
  }
}
