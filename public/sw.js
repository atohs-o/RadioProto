// Service Worker: 音声ファイルのバイナリをキャッシュ
// バージョンを変えると古いキャッシュが削除される（デプロイ時に更新）
const AUDIO_CACHE = 'autodj-audio-v1'

self.addEventListener('install', () => {
  // skipWaiting は使わない（更新タイミングを制御しやすくするため）
})

self.addEventListener('activate', (event) => {
  // 旧バージョンのキャッシュをパージ
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== AUDIO_CACHE).map((k) => caches.delete(k))),
      ),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // /audio-cache/<audioFileId> へのリクエストをキャッシュから応答
  if (url.pathname.startsWith('/audio-cache/')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => cached ?? fetch(event.request)),
      ),
    )
  }
})
