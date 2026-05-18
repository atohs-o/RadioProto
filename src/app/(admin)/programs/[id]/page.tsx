import { getProgram } from '@/lib/api/programs'
import { getContents } from '@/lib/api/contents'
import { getContentGroups } from '@/lib/api/content-groups'
import { notFound } from 'next/navigation'
import { ProgramEditor } from './_components/program-editor'

interface ProgramEditPageProps {
  params: Promise<{ id: string }>
}

export default async function ProgramEditPage({ params }: ProgramEditPageProps) {
  const { id } = await params

  const [allContents, contentGroups] = await Promise.all([
    getContents(),
    getContentGroups(),
  ])
  const generatedContents = allContents
    .filter((c) => c.audioStatus === 'generated')
    .map((c) => ({ id: c.id, title: c.title, audioDurationSec: c.audioDurationSec, groupId: c.groupId }))

  if (id === 'new') {
    return (
      <ProgramEditor
        program={{
          id: '',
          name: '',
          enabled: true,
          routePoints: [],
          shapes: [],
          stops: [],
          items: [],
          updatedAt: new Date().toISOString(),
        }}
        isNew
        generatedContents={generatedContents}
        contentGroups={contentGroups}
      />
    )
  }

  const program = await getProgram(id)

  if (!program) {
    notFound()
  }

  return (
    <ProgramEditor
      program={program}
      generatedContents={generatedContents}
      contentGroups={contentGroups}
    />
  )
}
