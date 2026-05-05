// 移行期の後方互換 re-export。新規コードは src/lib/supabase/* を直接 import すること
export { createAdminClient as createServiceClient } from './supabase/admin'
