'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Program } from '@/lib/schemas'
import type { Json } from '@/types/database.types'

type ActionResult = { error?: string }

export async function saveProgramAction(
  program: Program,
  isNew: boolean
): Promise<ActionResult & { id?: string }> {
  const adminClient = createAdminClient()

  try {
    let programId: string

    if (isNew) {
      const { data, error } = await adminClient
        .from('radio_programs')
        .insert({
          name: program.name,
          program_type: 'route_bus',
          is_active: program.enabled,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) return { error: error.message }
      programId = data.id
    } else {
      programId = program.id
      const { error } = await adminClient
        .from('radio_programs')
        .update({
          name: program.name,
          is_active: program.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', programId)

      if (error) return { error: error.message }
    }

    // 路線データの同期
    const { data: existingRoute } = await adminClient
      .from('routes')
      .select('id')
      .eq('radio_program_id', programId)
      .maybeSingle()

    if (existingRoute) {
      await adminClient
        .from('routes')
        .update({
          geometry: program.routePoints as unknown as Json,
          source: 'csv_import',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRoute.id)
    } else if (program.routePoints.length > 0) {
      await adminClient.from('routes').insert({
        radio_program_id: programId,
        geometry: program.routePoints as unknown as Json,
        source: 'csv_import',
      })
    }

    // アイテムの同期: 全件削除 → 全件挿入
    await adminClient
      .from('radio_program_items')
      .delete()
      .eq('radio_program_id', programId)

    if (program.items.length > 0) {
      const { error: itemsError } = await adminClient
        .from('radio_program_items')
        .insert(
          program.items.map((item, index) => ({
            radio_program_id: programId,
            content_id: item.contentId,
            lat: item.position.lat,
            lng: item.position.lng,
            display_name: item.locationName,
            sequence: index,
          }))
        )

      if (itemsError) return { error: itemsError.message }
    }

    revalidatePath('/programs')
    revalidatePath(`/programs/${programId}`)
    return { id: programId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '保存に失敗しました' }
  }
}

export async function deleteProgramAction(id: string): Promise<ActionResult> {
  const adminClient = createAdminClient()
  try {
    const { error } = await adminClient.from('radio_programs').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/programs')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}

export async function updateProgramEnabledAction(
  id: string,
  enabled: boolean
): Promise<ActionResult> {
  const adminClient = createAdminClient()
  try {
    const { error } = await adminClient
      .from('radio_programs')
      .update({ is_active: enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/programs')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '更新に失敗しました' }
  }
}
