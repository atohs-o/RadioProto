import { z } from 'zod'

export const contentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string().optional(),
  sourceType: z.enum(['polling', 'manual', 'url']),
  tags: z.array(z.string()),
  audioStatus: z.enum(['pending', 'generating', 'generated', 'error']),
  radioRegistered: z.boolean(),
  sourceText: z.string().optional(),
  scriptText: z.string().optional(),
  audioUrl: z.string().optional(),
  audioDurationSec: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Content = z.infer<typeof contentSchema>
