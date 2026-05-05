import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { publicEnv, getServerEnv } from '@/lib/env'

// ★ 'use client' ファイルで import 禁止。API Route / Edge Function のみ使用
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv()
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
