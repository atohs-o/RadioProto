import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getContentGroup } from '@/lib/api/content-groups'
import { getContentsByGroupId } from '@/lib/api/contents'
import { ContentsGroupPageClient } from './contents-group-page-client'

interface Props {
  params: Promise<{ group_id: string }>
}

export default async function ContentsGroupPage({ params }: Props) {
  const { group_id } = await params
  const [group, contents] = await Promise.all([
    getContentGroup(group_id),
    getContentsByGroupId(group_id),
  ])

  if (!group) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/contents"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          グループ一覧
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        {group.description && (
          <p className="mt-1 text-muted-foreground">{group.description}</p>
        )}
      </div>
      <ContentsGroupPageClient
        contents={contents}
        groupId={group_id}
      />
    </div>
  )
}
