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

const programShapeSchema = z.object({
  shapeId: z.string(),
  points: z.array(z.object({ lat: z.number(), lng: z.number(), seq: z.number() })),
})

const programStopSchema = z.object({
  stopName: z.string(),
  lat: z.number(),
  lng: z.number(),
})

export const programSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  enabled: z.boolean(),
  groupId: z.string().uuid().optional(),
  routePoints: z.array(z.object({ lat: z.number(), lng: z.number() })),
  shapes: z.array(programShapeSchema).optional(),
  stops: z.array(programStopSchema).optional(),
  items: z.array(z.object({
    id: z.string().uuid(),
    position: z.object({ lat: z.number(), lng: z.number() }),
    locationName: z.string(),
    contentId: z.string().uuid(),
    contentTitle: z.string(),
    audioDurationSec: z.number(),
    audioFileId: z.string().uuid().nullable().optional(),
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
