'use client'

import { useCallback, useState } from 'react'
import { Upload, FileText, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { parseGTFSStops, type GTFSStop } from '@/lib/csv'

type Step = 1 | 2 | 3

interface GtfsImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (stops: GTFSStop[]) => void
}

export function GtfsImportDialog({
  open,
  onOpenChange,
  onImport,
}: GtfsImportDialogProps) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [stops, setStops] = useState<GTFSStop[]>([])
  const [skipped, setSkipped] = useState(0)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleReset = useCallback(() => {
    setStep(1)
    setFile(null)
    setStops([])
    setSkipped(0)
    setParseError(null)
    setIsDragging(false)
  }, [])

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) handleReset()
      onOpenChange(isOpen)
    },
    [onOpenChange, handleReset]
  )

  const processFile = useCallback(async (f: File) => {
    setParseError(null)
    const text = await f.text()
    try {
      const result = parseGTFSStops(text)
      setFile(f)
      setStops(result.stops)
      setSkipped(result.skipped)
      setStep(2)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'パースに失敗しました')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) processFile(f)
    },
    [processFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) processFile(f)
    },
    [processFile]
  )

  const handleImport = useCallback(() => {
    onImport(stops)
    handleClose(false)
  }, [stops, onImport, handleClose])

  const previewStops = stops.slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>バス停インポート（stops.txt）</DialogTitle>
          <DialogDescription>
            GTFS形式の stops.txt をアップロードしてバス停を一括登録します
          </DialogDescription>
        </DialogHeader>

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-sm font-medium',
                  step >= s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {step > s ? <Check className="size-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    'h-0.5 w-8',
                    step > s ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* ステップ1: ファイル選択 */}
        {step === 1 && (
          <div className="space-y-3">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25'
              )}
            >
              <Upload className="mb-4 size-12 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                stops.txt をドラッグ&ドロップ
              </p>
              <p className="mb-4 text-xs text-muted-foreground">または</p>
              <label>
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button type="button" variant="outline" asChild>
                  <span>ファイルを選択</span>
                </Button>
              </label>
            </div>
            {parseError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {parseError}
              </div>
            )}
          </div>
        )}

        {/* ステップ2: プレビュー */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              <FileText className="size-5 text-muted-foreground" />
              <span className="text-sm">{file?.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {stops.length}件
              </span>
            </div>
            {skipped > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {skipped}件の行をスキップしました（stop_lat/stop_lon が無効）
              </div>
            )}
            <div className="max-h-64 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>停留所名</TableHead>
                    <TableHead className="w-28 text-right">緯度</TableHead>
                    <TableHead className="w-28 text-right">経度</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewStops.map((stop, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-48 truncate font-medium">
                        {stop.stopName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {stop.lat.toFixed(6)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {stop.lng.toFixed(6)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {stops.length > 5 && (
              <p className="text-center text-xs text-muted-foreground">
                他 {stops.length - 5} 件
              </p>
            )}
          </div>
        )}

        {/* ステップ3: 確認 */}
        {step === 3 && (
          <div className="flex flex-col items-center py-8">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Check className="size-8 text-primary" />
            </div>
            <p className="text-lg font-medium">インポート準備完了</p>
            <p className="text-sm text-muted-foreground">
              {stops.length}件のバス停をインポートします
            </p>
            {skipped > 0 && (
              <p className="mt-1 text-xs text-amber-600">
                （{skipped}件はスキップ）
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              キャンセル
            </Button>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={handleReset}>
                戻る
              </Button>
              <Button onClick={() => setStep(3)} disabled={stops.length === 0}>
                確認
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={() => setStep(2)}>
                戻る
              </Button>
              <Button onClick={handleImport}>インポート</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
