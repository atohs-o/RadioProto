import { z } from 'zod'

export const DeviceAuthResponseSchema = z.object({
  busId: z.string().uuid(),
  deviceId: z.string().uuid(),
  busCode: z.string(),
})
export type DeviceAuthResponse = z.infer<typeof DeviceAuthResponseSchema>

export const ClientProgramItemSchema = z.object({
  id: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  displayName: z.string().nullable(),
  contentTitle: z.string(),
  audioFileId: z.string().uuid().nullable(),
  durationSeconds: z.number().nullable(),
  sequence: z.number().nullable(),
})
export type ClientProgramItem = z.infer<typeof ClientProgramItemSchema>

const ClientShapePointSchema = z.object({ lat: z.number(), lng: z.number() })
const ClientProgramShapeSchema = z.object({
  shapeId: z.string(),
  points: z.array(ClientShapePointSchema),
})
export type ClientProgramShape = z.infer<typeof ClientProgramShapeSchema>

export const ClientProgramSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  items: z.array(ClientProgramItemSchema),
  shapes: z.array(ClientProgramShapeSchema).default([]),
})
export type ClientProgram = z.infer<typeof ClientProgramSchema>

export const AudioSignedUrlResponseSchema = z.object({
  signedUrl: z.string().url(),
})
export type AudioSignedUrlResponse = z.infer<typeof AudioSignedUrlResponseSchema>

export const StartTripBodySchema = z.object({
  radioProgramId: z.string().uuid(),
})

export const StartTripResponseSchema = z.object({
  tripId: z.string().uuid(),
})
export type StartTripResponse = z.infer<typeof StartTripResponseSchema>

export const EndTripBodySchema = z.object({
  tripId: z.string().uuid(),
})

export const LocationBodySchema = z.object({
  tripId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  heading: z.number().optional(),
  speedKmh: z.number().optional(),
})

export const PlaybackEventBodySchema = z.object({
  tripId: z.string().uuid(),
  radioProgramItemId: z.string().uuid(),
  status: z.enum(['played', 'skipped', 'failed', 'cancelled']),
  durationSeconds: z.number().optional(),
})

// GET /api/client/bus レスポンス
export const ClientBusStateSchema = z.object({
  isManualOverride: z.boolean(),
  currentProgramId: z.string().uuid().nullable(),
  manualProgramId: z.string().uuid().nullable(),
  currentProgramName: z.string().nullable(),
})
export type ClientBusState = z.infer<typeof ClientBusStateSchema>

// PATCH /api/client/bus リクエストボディ
export const PatchBusBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('setManual'), programId: z.string().uuid() }),
  z.object({ action: z.literal('clearManual') }),
])

// GET /api/client/programs レスポンス要素
export const ClientProgramSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  itemCount: z.number().int().nonnegative(),
})
export type ClientProgramSummary = z.infer<typeof ClientProgramSummarySchema>
