import { Loader } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader className="h-10 w-10 text-primary animate-spin mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">読み込み中...</p>
      </div>
    </div>
  )
}
