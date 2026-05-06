import { type NextRequest, NextResponse } from 'next/server'
import { resolveDevice } from '../_lib/device-auth'

export async function GET(request: NextRequest) {
  const device = await resolveDevice(request)
  if (!device) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 })
  }
  return NextResponse.json({
    busId: device.busId,
    deviceId: device.deviceId,
    busCode: device.busCode,
  })
}
