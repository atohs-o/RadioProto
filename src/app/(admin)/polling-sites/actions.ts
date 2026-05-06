'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { error?: string }

export async function createPollingSiteAction(
  data: { name: string; url: string }
): Promise<ActionResult & { id?: string }> {
  try {
    const supabase = createAdminClient()
    const { data: row, error } = await supabase
      .from('polling_sites')
      .insert({
        name: data.name,
        url: data.url,
        is_active: true,
        last_status: 'pending',
      })
      .select('id')
      .single()

    if (error) return { error: error.message }

    revalidatePath('/polling-sites')
    return { id: row.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '作成に失敗しました' }
  }
}

export async function togglePollingSiteAction(
  id: string,
  enabled: boolean
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('polling_sites')
      .update({ is_active: enabled, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/polling-sites')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '更新に失敗しました' }
  }
}

export async function deletePollingSiteAction(id: string): Promise<ActionResult> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('polling_sites')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/polling-sites')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}
