import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type { RealtimeChannel }

// MVP: anon key を使った broadcast（サーバー側 RLS チェックなし、§9-3 参照）
export function createLocationChannel(busId: string): RealtimeChannel {
  const supabase = createClient()
  return supabase.channel(`bus:${busId}`, {
    config: { broadcast: { self: false, ack: false } },
  })
}

export async function sendLocation(
  channel: RealtimeChannel,
  lat: number,
  lng: number,
  heading?: number | null,
  speed?: number | null,
): Promise<void> {
  await channel.send({
    type: 'broadcast',
    event: 'location',
    payload: { lat, lng, heading: heading ?? null, speed: speed ?? null, ts: Date.now() },
  })
}
