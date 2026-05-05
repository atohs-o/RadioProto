import { z } from 'zod'

export const contentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string().optional(),
  sourceType: z.enum(['polling', 'manual', 'url']),
  tags: z.array(z.string()),
  audioStatus: z.enum(['pending', 'generating', 'generated', 'error']),
  radioRegistered: z.boolean(),
  scriptText: z.string().optional(),
  audioDurationSec: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Content = z.infer<typeof contentSchema>

export const programSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  enabled: z.boolean(),
  routePoints: z.array(z.object({ lat: z.number(), lng: z.number() })),
  items: z.array(z.object({
    id: z.string().uuid(),
    position: z.object({ lat: z.number(), lng: z.number() }),
    locationName: z.string(),
    contentTitle: z.string(),
    audioDurationSec: z.number(),
  })),
  updatedAt: z.string(),
})
export type Program = z.infer<typeof programSchema>

export const pollingSiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  enabled: z.boolean(),
  lastFetchedAt: z.string().optional(),
  lastStatus: z.enum(['success', 'error', 'pending']).optional(),
})
export type PollingSite = z.infer<typeof pollingSiteSchema>
