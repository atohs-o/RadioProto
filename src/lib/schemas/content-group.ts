import { z } from 'zod'

export const contentGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  contentCount: z.number(),
})
export type ContentGroup = z.infer<typeof contentGroupSchema>

export const contentGroupFormSchema = z.object({
  name: z.string().min(1, 'グループ名を入力してください').max(100),
  description: z.string().optional(),
  tags_csv: z.string().optional(),
})
export type ContentGroupForm = z.infer<typeof contentGroupFormSchema>
