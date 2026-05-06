import { z } from 'zod'

export const pollingSiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  enabled: z.boolean(),
  lastFetchedAt: z.string().optional(),
  lastStatus: z.enum(['success', 'failure', 'pending']).optional(),
  lastError: z.string().optional(),
})

export type PollingSite = z.infer<typeof pollingSiteSchema>
