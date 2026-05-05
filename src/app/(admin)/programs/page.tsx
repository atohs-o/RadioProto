import { getPrograms } from '@/lib/stubs'
import { ProgramsPageClient } from './programs-page-client'

export default async function ProgramsPage() {
  const programs = await getPrograms()

  return <ProgramsPageClient programs={programs} />
}
