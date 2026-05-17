"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type LowProgressDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function LowProgressDialog({ open, onOpenChange, onConfirm }: LowProgressDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl sm:text-2xl">
            コンテンツが多く残っています
          </AlertDialogTitle>
          <AlertDialogDescription className="text-lg sm:text-xl">
            未再生のコンテンツが多く残っています。手動で終了しますか？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex flex-row gap-4 sm:justify-end">
          <AlertDialogCancel className="min-h-[44px] flex-1 text-lg sm:flex-none sm:px-8">
            続ける
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="min-h-[44px] flex-1 bg-destructive text-white hover:bg-destructive/90 text-lg sm:flex-none sm:px-8"
          >
            終了する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
