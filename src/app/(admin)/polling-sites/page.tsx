import { getPollingSites } from '@/lib/api/polling-sites'
import { PollingSitesPageClient } from './polling-sites-page-client'

export default async function PollingSitesPage() {
  const sites = await getPollingSites()
  return <PollingSitesPageClient sites={sites} />
}
