import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  contentGroupFormSchema,
  type ContentGroup,
  type ContentGroupForm,
} from '@/lib/schemas/content-group'
import type { Database } from '@/types/database.types'

type ContentGroupRow = Database['public']['Tables']['content_groups']['Row']

function toContentGroup(row: ContentGroupRow, contentCount = 0): ContentGroup {
  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : []
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contentCount,
  }
}

export async function getContentGroups(): Promise<ContentGroup[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_groups')
    .select('*, contents(count)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const countArr = Array.isArray(row.contents) ? row.contents : []
    const contentCount = (countArr[0] as { count: number } | undefined)?.count ?? 0
    return toContentGroup(row, contentCount)
  })
}

export async function getContentGroup(id: string): Promise<ContentGroup | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_groups')
    .select('*, contents(count)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const countArr = Array.isArray(data.contents) ? data.contents : []
  const contentCount = (countArr[0] as { count: number } | undefined)?.count ?? 0
  return toContentGroup(data, contentCount)
}

export async function createContentGroup(form: ContentGroupForm): Promise<ContentGroup> {
  const validated = contentGroupFormSchema.parse(form)
  const adminClient = createAdminClient()

  const tags = validated.tags_csv
    ? validated.tags_csv.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  const { data, error } = await adminClient
    .from('content_groups')
    .insert({
      name: validated.name,
      description: validated.description ?? null,
      tags,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toContentGroup(data, 0)
}

export async function updateContentGroup(
  id: string,
  form: Partial<ContentGroupForm>
): Promise<ContentGroup | null> {
  const adminClient = createAdminClient()

  const updatePayload: Database['public']['Tables']['content_groups']['Update'] = {
    updated_at: new Date().toISOString(),
  }
  if (form.name !== undefined) updatePayload.name = form.name
  if (form.description !== undefined) updatePayload.description = form.description ?? null
  if (form.tags_csv !== undefined) {
    updatePayload.tags = form.tags_csv
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }

  const { data, error } = await adminClient
    .from('content_groups')
    .update(updatePayload)
    .eq('id', id)
    .select('*, contents(count)')
    .single()

  if (error) throw new Error(error.message)

  const countArr = Array.isArray(data.contents) ? data.contents : []
  const contentCount = (countArr[0] as { count: number } | undefined)?.count ?? 0
  return toContentGroup(data, contentCount)
}

export async function deleteContentGroup(id: string): Promise<void> {
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('content_groups').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
