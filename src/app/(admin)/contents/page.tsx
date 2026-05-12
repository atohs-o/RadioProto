import { getContentGroups } from '@/lib/api/content-groups'
import { ContentsPageClient } from './contents-page-client'

export default async function ContentsPage() {
  const groups = await getContentGroups()
  return <ContentsPageClient groups={groups} />
}
