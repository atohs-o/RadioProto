'use client'

import { useCallback, useState } from 'react'
import { Upload, FileText, Check } from 'lucide-react'
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

type CsvImportModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (data: unknown[]) => void
}

type Step = 1 | 2 | 3

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n')
  const headers = lines[0]?.split(',').map((h) => h.trim()) ?? []
  const rows = lines.slice(1).map((line) => line.split(',').map((c) => c.trim()))
  return { headers, rows }
}

export function CsvImportModal({
  open,
  onOpenChange,
  onImport,
}: CsvImportModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [isDragging, setIsDragging] = useState(false)

  const handleReset = useCallback(() => {
    setStep(1)
    setFile(null)
    setHeaders([])
    setRows([])
    setIsDragging(false)
  }, [])

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        handleReset()
      }
      onOpenChange(isOpen)
    },
    [onOpenChange, handleReset]
  )

  const processFile = useCallback(async (f: File) => {
    const text = await f.text()
    const { headers: h, rows: r } = parseCSV(text)
    setFile(f)
    setHeaders(h)
    setRows(r)
    setStep(2)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files[0]
      if (f && f.name.endsWith('.csv')) {
        processFile(f)
      }
    },
    [processFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) {
        processFile(f)
      }
    },
    [processFile]
  )

  const handleConfirm = useCallback(() => {
    setStep(3)
  }, [])

  const handleImport = useCallback(() => {
    const data = rows.map((row) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? ''
      })
      return obj
    })
    onImport(data)
    handleClose(false)
  }, [rows, headers, onImport, handleClose])

  const previewRows = rows.slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>CSVインポート</DialogTitle>
          <DialogDescription>
            CSVファイルをインポートして、データを一括登録します
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
              CSVファイルをドラッグ&ドロップ
            </p>
            <p className="mb-4 text-xs text-muted-foreground">または</p>
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button type="button" variant="outline" asChild>
                <span>ファイルを選択</span>
              </Button>
            </label>
          </div>
        )}

        {/* ステップ2: プレビュー */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              <FileText className="size-5 text-muted-foreground" />
              <span className="text-sm">{file?.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {rows.length}行
              </span>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((h, i) => (
                      <TableHead key={i}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="max-w-48 truncate">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 5 && (
              <p className="text-center text-xs text-muted-foreground">
                他 {rows.length - 5} 行
              </p>
            )}
          </div>
        )}

        {/* ステップ3: 確定 */}
        {step === 3 && (
          <div className="flex flex-col items-center py-8">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Check className="size-8 text-primary" />
            </div>
            <p className="text-lg font-medium">インポート準備完了</p>
            <p className="text-sm text-muted-foreground">
              {rows.length}件のデータをインポートします
            </p>
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
              <Button onClick={handleConfirm}>確認</Button>
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
