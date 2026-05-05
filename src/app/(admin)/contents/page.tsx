import { getContents } from '@/lib/stubs'
import { ContentsPageClient } from './contents-page-client'

export default async function ContentsPage() {
  const contents = await getContents()

  return <ContentsPageClient contents={contents} />
}
