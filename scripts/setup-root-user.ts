/**
 * 初回ルートユーザー作成スクリプト
 *
 * 実行前に .env.local に以下を設定:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   ROOT_EMAIL=...
 *   ROOT_PASSWORD=...
 *
 * 実行:
 *   ROOT_EMAIL=xxx@example.com ROOT_PASSWORD=yourpassword npx tsx scripts/setup-root-user.ts
 *
 * または .env.local に ROOT_EMAIL / ROOT_PASSWORD を追記して:
 *   npx tsx --env-file=.env.local scripts/setup-root-user.ts
 */

import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = process.env.ROOT_EMAIL
  const password = process.env.ROOT_PASSWORD

  if (!url || !serviceKey || !email || !password) {
    throw new Error(
      '以下の環境変数を設定してください:\n' +
        '  NEXT_PUBLIC_SUPABASE_URL\n' +
        '  SUPABASE_SERVICE_ROLE_KEY\n' +
        '  ROOT_EMAIL\n' +
        '  ROOT_PASSWORD'
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) throw error

  console.log('ルートユーザー作成完了')
  console.log('  user_id:', data.user?.id)
  console.log('  email  :', email)
  console.log('profiles.role = root はトリガー(handle_new_user)が自動付与します')
}

main().catch(err => {
  console.error('エラー:', err.message ?? err)
  process.exit(1)
})
