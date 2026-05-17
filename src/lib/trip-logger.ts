export type TripEventType =
  | 'gps_lost'
  | 'gps_recovered'
  | 'server_lost'
  | 'server_recovered'
  | 'auth_failed'
  | 'trip_started'
  | 'trip_ended'
  | 'abnormal_ended'
  | 'timeout_ended'
  | 'sequence_advanced'
  | 'playback_error'
  | 'location_update'

class TripLogger {
  private deviceToken: string | null = null

  setToken(token: string): void {
    this.deviceToken = token
  }

  log(
    tripId: string,
    eventType: TripEventType,
    metadata: Record<string, unknown> = {}
  ): void {
    if (process.env.NEXT_PUBLIC_DEBUG_MODE !== 'true') return
    if (!tripId || !this.deviceToken) return
    fetch('/api/client/trip-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': this.deviceToken,
      },
      body: JSON.stringify({ tripId, eventType, metadata }),
    }).catch(() => {})
  }

  destroy(): void {
    this.deviceToken = null
  }
}

export const tripLogger = new TripLogger()
