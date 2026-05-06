import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type DeviceInfo = {
  busId: string
  deviceId: string
  busCode: string
}

export async function resolveDevice(request: NextRequest): Promise<DeviceInfo | null> {
  const token = request.headers.get('X-Device-Token')
  if (!token) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('devices')
    .select('id, bus_id, buses(bus_code)')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!data) return null

  const buses = data.buses as { bus_code: string } | null
  if (!buses) return null

  // last_seen_at を非同期で更新（レスポンスをブロックしない）
  supabase
    .from('devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)
    .then()

  return {
    busId: data.bus_id,
    deviceId: data.id,
    busCode: buses.bus_code,
  }
}
