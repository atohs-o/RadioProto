import type { Viewport } from 'next'

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
      {children}
    </div>
  )
}
