import { createClient } from 'npm:@supabase/supabase-js'
import { stripHtml } from '../_shared/strip-html.ts'
import { summarizeForRadio } from '../_shared/gemini.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function processSite(site: {
  id: string
  name: string
  url: string
}): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  let rawText: string
  try {
    const response = await fetch(site.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AutoDJ-Radio-Bot/1.0' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const html = await response.text()
    rawText = stripHtml(html)
  } finally {
    clearTimeout(timeout)
  }

  if (!rawText.trim()) throw new Error('ページ本文が空です')

  const hash = await computeHash(rawText)

  // 重複チェック
  const { data: existing } = await supabase
    .from('contents')
    .select('id')
    .eq('source_polling_site_id', site.id)
    .filter('metadata->>raw_content_hash', 'eq', hash)
    .limit(1)

  if (existing && existing.length > 0) {
    console.log(`[${site.name}] 重複コンテンツのためスキップ`)
    await supabase
      .from('polling_sites')
      .update({
        last_polled_at: new Date().toISOString(),
        last_status: 'success',
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', site.id)
    return
  }

  const result = await summarizeForRadio(rawText, site.name)

  const { error: insertError } = await supabase.from('contents').insert({
    title: result.title,
    script: result.script,
    summary: result.summary ?? null,
    source_type: 'polling',
    source_url: site.url,
    source_polling_site_id: site.id,
    metadata: {
      audio_status: 'pending',
      radio_registered: false,
      tags: [],
      script_versions: [],
      raw_content_hash: hash,
      polled_model: Deno.env.get('GEMINI_SCRIPTIFY_MODEL') ?? 'gemini-2.5-flash',
    },
  })

  if (insertError) throw new Error(`contents INSERT エラー: ${insertError.message}`)

  await supabase
    .from('polling_sites')
    .update({
      last_polled_at: new Date().toISOString(),
      last_status: 'success',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', site.id)

  console.log(`[${site.name}] コンテンツを作成しました: ${result.title}`)
}

Deno.serve(async () => {
  const { data: sites, error } = await supabase
    .from('polling_sites')
    .select('id, name, url')
    .eq('is_active', true)

  if (error) {
    console.error('ポーリングサイト取得エラー:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!sites || sites.length === 0) {
    console.log('有効なポーリングサイトがありません')
    return new Response(JSON.stringify({ processed: 0 }))
  }

  const results = await Promise.allSettled(
    sites.map((site) => processSite(site))
  )

  let successCount = 0
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const site = sites[i]
    if (result.status === 'rejected') {
      const message = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason)
      console.error(`[${site.name}] 失敗: ${message}`)
      await supabase
        .from('polling_sites')
        .update({
          last_polled_at: new Date().toISOString(),
          last_status: 'failure',
          last_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', site.id)
    } else {
      successCount++
    }
  }

  console.log(`完了: ${successCount}/${sites.length} サイト成功`)
  return new Response(
    JSON.stringify({ processed: sites.length, success: successCount }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
