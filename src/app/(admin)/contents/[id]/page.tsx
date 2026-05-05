import { notFound } from 'next/navigation'
import { getContentById } from '@/lib/api/contents'
import { ContentEditClient } from './content-edit-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ContentPage({ params }: Props) {
  const { id } = await params

  if (id === 'new') {
    return <ContentEditClient content={null} />
  }

  const content = await getContentById(id)
  if (!content) notFound()

  return <ContentEditClient content={content} />
}
