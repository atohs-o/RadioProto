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
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini API エラー: ${response.status} ${body}`)
  }

  const data = await response.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  const parsed = JSON.parse(text) as GeminiResult
  if (!parsed.title || !parsed.script) {
    throw new Error('Gemini のレスポンスに必須フィールドがありません')
  }
  return parsed
}
