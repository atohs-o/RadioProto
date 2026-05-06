'use client'

import { useEffect } from 'react'

export function SWRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service Worker 登録失敗:', err)
    })
  }, [])

  return null
}
