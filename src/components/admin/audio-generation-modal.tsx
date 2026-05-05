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
import { Spinner } from '@/components/ui/spinner'
import type { AudioFileInfo } from '@/lib/schemas/content'

type GenerationStatus = 'idle' | 'generating' | 'done' | 'error'

type AudioGenerationModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contentId: string
  scriptText: string
  ttsModel: string
  onComplete: (audioFile: AudioFileInfo) => void
  onCancel: () => void
}

export function AudioGenerationModal({
  open,
  onOpenChange,
  contentId,
  scriptText,
  ttsModel,
  onComplete,
  onCancel,
}: AudioGenerationModalProps) {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fakeProgress, setFakeProgress] = useState(0)

  useEffect(() => {
    if (!open) {
      setStatus('idle')
      setErrorMessage(null)
      setFakeProgress(0)
      return
    }

    const controller = new AbortController()
    setStatus('generating')
    setFakeProgress(0)

    const progressInterval = setInterval(() => {
      setFakeProgress((prev) => (prev >= 85 ? prev : prev + 2))
    }, 700)

    async function generate() {
      try {
        const res = await fetch('/api/admin/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentId, scriptText, model: ttsModel }),
          signal: controller.signal,
        })

        clearInterval(progressInterval)

        const data = await res.json() as {
          audioUrl?: string
          durationSeconds?: number
          audioFileId?: string
          ttsModel?: string
          createdAt?: string
          error?: string
        }

        if (!res.ok || !data.audioUrl || !data.audioFileId) {
          setErrorMessage(data.error ?? '音声生成に失敗しました')
          setStatus('error')
          return
        }

        setFakeProgress(100)
        setStatus('done')
        const audioFile: AudioFileInfo = {
          id: data.audioFileId,
          url: data.audioUrl,
          durationSeconds: data.durationSeconds,
          ttsModel: data.ttsModel ?? ttsModel,
          createdAt: data.createdAt ?? new Date().toISOString(),
        }
        setTimeout(() => {
          onComplete(audioFile)
          onOpenChange(false)
        }, 600)
      } catch (e) {
        clearInterval(progressInterval)
        if (e instanceof Error && e.name === 'AbortError') return
        setErrorMessage('音声生成中にエラーが発生しました')
        setStatus('error')
      }
    }

    generate()

    return () => {
      clearInterval(progressInterval)
      controller.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleCancel = () => {
    setStatus('idle')
    setErrorMessage(null)
    setFakeProgress(0)
    onCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>音声生成中</DialogTitle>
          <DialogDescription>
            {status === 'error'
              ? '音声の生成に失敗しました。'
              : '音声を生成しています。しばらくお待ちください...'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {status === 'generating' && (
            <div className="flex flex-col items-center gap-4">
              <Spinner className="size-8" />
              <Progress value={fakeProgress} className="h-2 w-full" />
              <p className="text-center text-sm text-muted-foreground">
                処理中... (数十秒かかる場合があります)
              </p>
            </div>
          )}
          {status === 'done' && (
            <div className="flex flex-col items-center gap-2">
              <Progress value={100} className="h-2 w-full" />
              <p className="text-center text-sm text-muted-foreground">完了しました</p>
            </div>
          )}
          {status === 'error' && (
            <p className="text-center text-sm text-destructive">{errorMessage}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={status === 'done'}>
            キャンセル
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
