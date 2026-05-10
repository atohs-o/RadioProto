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

export const ClientProgramSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  items: z.array(ClientProgramItemSchema),
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
