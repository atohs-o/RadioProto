import type { Viewport } from 'next'
import { SWRegistrar } from '@/components/client/sw-registrar'
import { Toaster } from '@/components/ui/toaster'

export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false,
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background dark">
      <SWRegistrar />
      {children}
      <Toaster />
    </div>
  )
}
