"use client"

import { AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type PlaybackErrorDialogProps = {
  open: boolean
  contentTitle?: string
  onSkip: () => void
  onRetry: () => void
}

export function PlaybackErrorDialog({
  open,
  contentTitle,
  onSkip,
  onRetry,
}: PlaybackErrorDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader className="gap-4">
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-red/10">
              <AlertCircle className="h-10 w-10 text-brand-red" aria-hidden="true" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl sm:text-2xl">
            再生エラー
          </DialogTitle>
          <DialogDescription className="text-center text-lg sm:text-xl">
            {contentTitle
              ? `「${contentTitle}」の再生に失敗しました`
              : "コンテンツの再生に失敗しました"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex flex-row gap-4 sm:justify-center">
          <Button
            variant="outline"
            onClick={onSkip}
            className="min-h-[44px] flex-1 text-lg"
          >
            スキップ
          </Button>
          <Button
            onClick={onRetry}
            className="min-h-[44px] flex-1 text-lg"
          >
            再試行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
