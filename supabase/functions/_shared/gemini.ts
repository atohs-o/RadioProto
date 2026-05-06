import { GoogleAuth } from 'npm:google-auth-library'

interface GeminiResult {
  title: string
  summary: string
  script: string
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const credentials = JSON.parse(serviceAccountJson)
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  if (!tokenResponse.token) throw new Error('アクセストークンの取得に失敗しました')
  return tokenResponse.token
}

export async function summarizeForRadio(
  siteText: string,
  siteName: string
): Promise<GeminiResult> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  const project = Deno.env.get('GCP_PROJECT_ID')
  const location = Deno.env.get('GCP_LOCATION') ?? 'us-central1'
  const model = Deno.env.get('GEMINI_SCRIPTIFY_MODEL') ?? 'gemini-2.5-flash'

  if (!serviceAccountJson || !project) {
    throw new Error('Vertex AI の環境変数が設定されていません')
  }

  const token = await getAccessToken(serviceAccountJson)
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`

  const prompt = `以下は「${siteName}」のWebページ本文です。
地域のバス車内ラジオ番組向けに情報を抽出し、以下のJSON形式で返してください。

フィールド:
- title: 30文字以内のタイトル
- summary: 100文字以内の要約
- script: SPEAKER_1とSPEAKER_2の対話形式のラジオ台本（合計250〜400字）

Webページ本文:
${siteText}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini API エラー: ${response.status} ${body}`)
  }

  const responseText = await response.text()
  let data: unknown
  try {
    data = JSON.parse(responseText)
  } catch (e) {
    throw new Error(
      `Gemini レスポンスの JSON パース失敗: ${e instanceof Error ? e.message : String(e)} — 先頭100文字: ${responseText.slice(0, 100)}`
    )
  }

  const text: string =
    (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
      ?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let parsed: GeminiResult
  try {
    // ```json ... ``` ブロックを除去してから制御文字をサニタイズ
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    const sanitized = stripped.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    parsed = JSON.parse(sanitized) as GeminiResult
  } catch (e) {
    throw new Error(
      `Gemini 出力の JSON パース失敗: ${e instanceof Error ? e.message : String(e)} — 先頭100文字: ${text.slice(0, 100)}`
    )
  }

  if (!parsed.title || !parsed.script) {
    throw new Error('Gemini のレスポンスに必須フィールドがありません')
  }
  return parsed
}
