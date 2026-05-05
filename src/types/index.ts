export interface Bus {
  id: string
  busCode: string
  busName: string
  deviceToken: string
  lastConnectedAt?: string
  enabled: boolean
}

export interface Trip {
  id: string
  busCode: string
  startedAt: string
  endedAt?: string
  playCount: number
}

export interface PlayEvent {
  id: string
  contentTitle: string
  status: 'completed' | 'skipped' | 'error'
  playedAt: string
}

export interface UserProfile {
  displayName: string
  email: string
}

export type { GpsStatus, ServerStatus, PlaybackState } from '@/lib/types'
