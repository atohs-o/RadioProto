import { Tablet } from 'lucide-react'

export default function DeviceSetupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <Tablet className="h-24 w-24 text-muted-foreground mx-auto mb-8" />
        <h1 className="text-2xl font-bold text-foreground mb-4">
          このデバイスは未登録です
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          管理者にデバイスの登録を依頼してください
        </p>
      </div>
    </div>
  )
}
