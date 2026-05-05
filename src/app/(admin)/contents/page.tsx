import { getContents } from '@/src/lib/stub-api'
import { ContentsPageClient } from './contents-page-client'

export default async function ContentsPage() {
  const contents = await getContents()

  return <ContentsPageClient contents={contents} />
}
