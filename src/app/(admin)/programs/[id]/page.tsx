import { getProgram } from '@/lib/api/programs'
import { getContents } from '@/lib/api/contents'
import { notFound } from 'next/navigation'
import { ProgramEditor } from './_components/program-editor'

interface ProgramEditPageProps {
  params: Promise<{ id: string }>
}

export default async function ProgramEditPage({ params }: ProgramEditPageProps) {
  const { id } = await params

  const allContents = await getContents()
  const generatedContents = allContents
    .filter((c) => c.audioStatus === 'generated')
    .map((c) => ({ id: c.id, title: c.title, audioDurationSec: c.audioDurationSec }))

  if (id === 'new') {
    return (
      <ProgramEditor
        program={{
          id: '',
          name: '',
          enabled: true,
          routePoints: [],
          shapes: [],
          items: [],
          updatedAt: new Date().toISOString(),
        }}
        isNew
        generatedContents={generatedContents}
      />
    )
  }

  const program = await getProgram(id)

  if (!program) {
    notFound()
  }

  return <ProgramEditor program={program} generatedContents={generatedContents} />
}
