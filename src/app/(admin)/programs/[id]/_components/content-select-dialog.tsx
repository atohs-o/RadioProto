'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface GeneratedContent {
  id: string
  title: string
  audioDurationSec?: number
}

interface ContentSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clickedPosition: { lat: number; lng: number } | null
  contents: GeneratedContent[]
  onConfirm: (item: {
    contentId: string
    contentTitle: string
    audioDurationSec: number
    locationName: string
    position: { lat: number; lng: number }
  }) => void
}

function formatDuration(seconds: number) {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function ContentSelectDialog({
  open,
  onOpenChange,
  clickedPosition,
  contents,
  onConfirm,
}: ContentSelectDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState('')

  useEffect(() => {
    if (open) {
      setSelectedId(null)
      setLocationName('')
    }
  }, [open])

  const handleConfirm = () => {
    if (!selectedId || !clickedPosition) return
    const content = contents.find((c) => c.id === selectedId)
    if (!content) return

    onConfirm({
      contentId: content.id,
      contentTitle: content.title,
      audioDurationSec: content.audioDurationSec ?? 0,
      locationName: locationName.trim() || content.title,
      position: clickedPosition,
    })
    onOpenChange(false)
  }

  const canConfirm = selectedId !== null && clickedPosition !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>コンテンツを選択</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {clickedPosition && (
            <p className="text-sm text-muted-foreground">
              位置: {clickedPosition.lat.toFixed(5)}, {clickedPosition.lng.toFixed(5)}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="location-name">位置名称</Label>
            <Input
              id="location-name"
              placeholder="例: 穂高駅前（省略時はコンテンツ名）"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>

          <div className="rounded-md border overflow-y-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>コンテンツ名</TableHead>
                  <TableHead className="w-[70px] text-right">音声長</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                      音声生成済みのコンテンツがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  contents.map((content) => (
                    <TableRow
                      key={content.id}
                      className={`cursor-pointer ${selectedId === content.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedId(content.id)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          readOnly
                          checked={selectedId === content.id}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{content.title}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {content.audioDurationSec != null
                          ? formatDuration(content.audioDurationSec)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
