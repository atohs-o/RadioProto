'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { ContentFormSchema } from '@/lib/schemas/content'
import {
  createContent,
  updateContent,
  deleteContent,
} from '@/lib/api/contents'

type ActionResult = { error?: string }
type CreateActionResult = { error: string } | { error: null; id: string }

export async function createContentAction(data: unknown): Promise<CreateActionResult> {
  let validated
  try {
    validated = ContentFormSchema.parse(data)
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? '入力が不正です' }
    return { error: '入力が不正です' }
  }

  try {
    const content = await createContent(validated)
    revalidatePath('/contents')
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
    revalidatePath('/contents')
    revalidatePath(`/contents/${id}`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '更新に失敗しました' }
  }
}

export async function deleteContentAction(id: string): Promise<ActionResult> {
  try {
    await deleteContent(id)
    revalidatePath('/contents')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}
