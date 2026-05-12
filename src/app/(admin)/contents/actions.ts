'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { ContentFormSchema } from '@/lib/schemas/content'
import { contentGroupFormSchema } from '@/lib/schemas/content-group'
import {
  createContent,
  updateContent,
  deleteContent,
} from '@/lib/api/contents'
import {
  createContentGroup,
  updateContentGroup,
  deleteContentGroup,
} from '@/lib/api/content-groups'

type ActionResult = { error?: string }
type CreateActionResult = { error: string } | { error: null; id: string }

export async function createContentAction(
  data: unknown,
  groupId?: string
): Promise<CreateActionResult> {
  let validated
  try {
    validated = ContentFormSchema.parse(data)
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? '入力が不正です' }
    return { error: '入力が不正です' }
  }

  try {
    const content = await createContent(validated, groupId)
    revalidatePath('/contents', 'layout')
    return { error: null, id: content.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '作成に失敗しました' }
  }
}

export async function updateContentAction(
  id: string,
  data: unknown
): Promise<ActionResult> {
  let validated
  try {
    validated = ContentFormSchema.partial().parse(data)
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? '入力が不正です' }
    return { error: '入力が不正です' }
  }

  try {
    const result = await updateContent(id, validated)
    if (!result) return { error: 'コンテンツが見つかりません' }
    revalidatePath('/contents', 'layout')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '更新に失敗しました' }
  }
}

export async function deleteContentAction(id: string): Promise<ActionResult> {
  try {
    await deleteContent(id)
    revalidatePath('/contents', 'layout')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}

export async function setActiveAudioAction(
  contentId: string,
  audioFileId: string
): Promise<ActionResult> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  try {
    const { data: row } = await supabase
      .from('contents')
      .select('metadata')
      .eq('id', contentId)
      .single()
    if (!row) return { error: 'コンテンツが見つかりません' }

    const meta = { ...(row.metadata as Record<string, unknown> ?? {}), active_audio_file_id: audioFileId }
    const { error } = await supabase
      .from('contents')
      .update({ metadata: meta })
      .eq('id', contentId)

    if (error) return { error: error.message }
    revalidatePath('/contents', 'layout')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '更新に失敗しました' }
  }
}

export async function createContentGroupAction(
  data: unknown
): Promise<CreateActionResult> {
  let validated
  try {
    validated = contentGroupFormSchema.parse(data)
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? '入力が不正です' }
    return { error: '入力が不正です' }
  }

  try {
    const group = await createContentGroup(validated)
    revalidatePath('/contents', 'layout')
    return { error: null, id: group.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '作成に失敗しました' }
  }
}

export async function updateContentGroupAction(
  id: string,
  data: unknown
): Promise<ActionResult> {
  let validated
  try {
    validated = contentGroupFormSchema.partial().parse(data)
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? '入力が不正です' }
    return { error: '入力が不正です' }
  }

  try {
    const result = await updateContentGroup(id, validated)
    if (!result) return { error: 'グループが見つかりません' }
    revalidatePath('/contents', 'layout')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '更新に失敗しました' }
  }
}

export async function deleteContentGroupAction(id: string): Promise<ActionResult> {
  try {
    await deleteContentGroup(id)
    revalidatePath('/contents', 'layout')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}
