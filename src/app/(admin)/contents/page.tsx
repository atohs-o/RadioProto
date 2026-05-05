import { getContents } from '@/lib/api/contents'
import { ContentsPageClient } from './contents-page-client'

export default async function ContentsPage() {
  const contents = await getContents()

  return <ContentsPageClient contents={contents} />
}
