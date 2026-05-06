import { createClient } from '@/lib/supabase/server'
import type { PollingSite } from '@/lib/schemas/polling-sites'

export async function getPollingSites(): Promise<PollingSite[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('polling_sites')
    .select('id, name, url, is_active, last_polled_at, last_status, last_error')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: row.is_active,
    lastFetchedAt: row.last_polled_at ?? undefined,
    lastStatus: (row.last_status as PollingSite['lastStatus']) ?? undefined,
    lastError: row.last_error ?? undefined,
  }))
}
