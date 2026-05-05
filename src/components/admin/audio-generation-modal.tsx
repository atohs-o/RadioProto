'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

type AudioGenerationModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  onCancel: () => void
}

export function AudioGenerationModal({
  open,
  onOpenChange,
  onComplete,
  onCancel,
}: AudioGenerationModalProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!open) {
      setProgress(0)
      return
    }

    // シミュレート: 音声生成の進捗（スタブ）
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          // 完了後に自動でダイアログを閉じる
          setTimeout(() => {
            onComplete()
            onOpenChange(false)
          }, 500)
          return 100
        }
        return prev + 10
      })
    }, 500)

    return () => clearInterval(interval)
  }, [open, onComplete, onOpenChange])

  const handleCancel = () => {
    setProgress(0)
    onCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>音声生成中</DialogTitle>
          <DialogDescription>
            音声を生成しています。しばらくお待ちください...
          </DialogDescription>
        </DialogHeader>
        <div className="py-6">
          <Progress value={progress} className="h-2" />
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {progress}% 完了
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            キャンセル
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
