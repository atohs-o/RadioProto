import type { PollingSite } from '@/lib/schemas/polling-sites'
import { MOCK_POLLING_SITES } from '@/lib/mocks/polling-sites'

/**
 * ポーリングサイト一覧を取得
 * TODO: API接続はClaude Codeが実装
 */
export async function getPollingSites(): Promise<PollingSite[]> {
  return MOCK_POLLING_SITES
}

/**
 * ポーリングサイトを追加
 * TODO: API接続はClaude Codeが実装
 */
export async function createPollingSite(
  data: Pick<PollingSite, 'name' | 'url'>
): Promise<PollingSite> {
  const newSite: PollingSite = {
    id: crypto.randomUUID(),
    name: data.name,
    url: data.url,
    enabled: true,
    lastStatus: 'pending',
  }
  return newSite
}

/**
 * ポーリングサイトの有効/無効を切り替え
 * TODO: API接続はClaude Codeが実装
 */
export async function togglePollingSiteEnabled(
  id: string,
  enabled: boolean
): Promise<PollingSite | null> {
  const site = MOCK_POLLING_SITES.find((s) => s.id === id)
  if (!site) return null
  return { ...site, enabled }
}

/**
 * ポーリングサイトを削除
 * TODO: API接続はClaude Codeが実装
 */
export async function deletePollingSite(id: string): Promise<boolean> {
  const exists = MOCK_POLLING_SITES.some((s) => s.id === id)
  return exists
}
