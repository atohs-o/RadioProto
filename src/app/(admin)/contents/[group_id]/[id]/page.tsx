import { notFound } from 'next/navigation'
import { getContentById } from '@/lib/api/contents'
import { ContentEditClient } from './content-edit-client'

interface Props {
  params: Promise<{ group_id: string; id: string }>
}

export default async function ContentPage({ params }: Props) {
  const { group_id, id } = await params

  if (id === 'new') {
    return <ContentEditClient content={null} groupId={group_id} />
  }

  const content = await getContentById(id)
  if (!content) notFound()

  return <ContentEditClient content={content} groupId={group_id} />
}
