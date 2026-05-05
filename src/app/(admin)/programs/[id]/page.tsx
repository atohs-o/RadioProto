import { getProgram } from '@/lib/api/programs'
import { notFound } from 'next/navigation'
import { ProgramEditor } from './_components/program-editor'

interface ProgramEditPageProps {
  params: Promise<{ id: string }>
}

export default async function ProgramEditPage({ params }: ProgramEditPageProps) {
  const { id } = await params

  // 新規作成の場合
  if (id === 'new') {
    return (
      <ProgramEditor
        program={{
          id: '',
          name: '',
          enabled: true,
          routePoints: [],
          items: [],
          updatedAt: new Date().toISOString(),
        }}
        isNew
      />
    )
  }

  const program = await getProgram(id)

  if (!program) {
    notFound()
  }

  return <ProgramEditor program={program} />
}
