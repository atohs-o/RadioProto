import { GoogleAuth } from 'google-auth-library'
import { getServerEnv } from './env'

export async function getVertexAccessToken(): Promise<string> {
  const env = getServerEnv()
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as Record<string, unknown>
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  if (!tokenResponse.token) throw new Error('Vertex AI アクセストークンの取得に失敗しました')
  return tokenResponse.token
}

export function buildVertexUrl(model: string): string {
  const env = getServerEnv()
  return `https://${env.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/locations/${env.GCP_LOCATION}/publishers/google/models/${model}:generateContent`
}
