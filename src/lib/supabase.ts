import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 管理画面クライアント（anon key + JWT → RLS is_root() を通す）
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// サーバーサイド専用クライアント（RLS バイパス）
// ★ 'use client' ファイルで import 禁止。API Route / Edge Function のみ使用
export function createServiceClient() {
  return createClient<Database>(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
