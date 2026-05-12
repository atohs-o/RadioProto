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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { parseGTFSStops, parseGTFSShapes, type GTFSStop, type GTFSShape } from '@/lib/csv'

type Step = 1 | 2 | 3

interface GtfsImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (stops: GTFSStop[]) => void
  onImportShapes: (shapes: GTFSShape[]) => void
}

function StepIndicator({ step }: { step: Step }) {
  return (
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
  )
}

function DropZone({
  onFile,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  parseError,
}: {
  onFile: (f: File) => void
  isDragging: boolean
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  parseError: string | null
}) {
  return (
    <div className="space-y-3">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        )}
      >
        <Upload className="mb-4 size-12 text-muted-foreground" />
        <p className="mb-4 text-xs text-muted-foreground">または</p>
        <label>
          <input
            type="file"
            accept=".txt,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
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
  )
}

// stops.txt タブ
function StopsTab({
  onImport,
  onClose,
}: {
  onImport: (stops: GTFSStop[]) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [stops, setStops] = useState<GTFSStop[]>([])
  const [skipped, setSkipped] = useState(0)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const reset = useCallback(() => {
    setStep(1)
    setFile(null)
    setStops([])
    setSkipped(0)
    setParseError(null)
    setIsDragging(false)
  }, [])

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

  const handleImport = useCallback(() => {
    onImport(stops)
    onClose()
  }, [stops, onImport, onClose])

  const previewStops = stops.slice(0, 5)

  return (
    <>
      <StepIndicator step={step} />

      {step === 1 && (
        <DropZone
          onFile={processFile}
          isDragging={isDragging}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
          parseError={parseError}
        />
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
            <FileText className="size-5 text-muted-foreground" />
            <span className="text-sm">{file?.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{stops.length}件</span>
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
                    <TableCell className="max-w-48 truncate font-medium">{stop.stopName}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{stop.lat.toFixed(6)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{stop.lng.toFixed(6)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {stops.length > 5 && (
            <p className="text-center text-xs text-muted-foreground">他 {stops.length - 5} 件</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center py-8">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-8 text-primary" />
          </div>
          <p className="text-lg font-medium">インポート準備完了</p>
          <p className="text-sm text-muted-foreground">{stops.length}件のバス停をインポートします</p>
          {skipped > 0 && <p className="mt-1 text-xs text-amber-600">（{skipped}件はスキップ）</p>}
        </div>
      )}

      <DialogFooter>
        {step === 1 && <Button variant="outline" onClick={onClose}>キャンセル</Button>}
        {step === 2 && (
          <>
            <Button variant="outline" onClick={reset}>戻る</Button>
            <Button onClick={() => setStep(3)} disabled={stops.length === 0}>確認</Button>
          </>
        )}
        {step === 3 && (
          <>
            <Button variant="outline" onClick={() => setStep(2)}>戻る</Button>
            <Button onClick={handleImport}>インポート</Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}

// shapes.txt タブ
function ShapesTab({
  onImportShapes,
  onClose,
}: {
  onImportShapes: (shapes: GTFSShape[]) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [shapes, setShapes] = useState<GTFSShape[]>([])
  const [skipped, setSkipped] = useState(0)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const reset = useCallback(() => {
    setStep(1)
    setFile(null)
    setShapes([])
    setSkipped(0)
    setParseError(null)
    setIsDragging(false)
  }, [])

  const processFile = useCallback(async (f: File) => {
    setParseError(null)
    const text = await f.text()
    try {
      const result = parseGTFSShapes(text)
      setFile(f)
      setShapes(result.shapes)
      setSkipped(result.skipped)
      setStep(2)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'パースに失敗しました')
    }
  }, [])

  const handleImport = useCallback(() => {
    onImportShapes(shapes)
    onClose()
  }, [shapes, onImportShapes, onClose])

  const totalPoints = shapes.reduce((sum, s) => sum + s.points.length, 0)
  const previewShapes = shapes.slice(0, 5)

  return (
    <>
      <StepIndicator step={step} />

      {step === 1 && (
        <DropZone
          onFile={processFile}
          isDragging={isDragging}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
          parseError={parseError}
        />
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
            <FileText className="size-5 text-muted-foreground" />
            <span className="text-sm">{file?.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{shapes.length}路線</span>
          </div>
          {skipped > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {skipped}件の行をスキップしました（座標またはシーケンスが無効）
            </div>
          )}
          <div className="max-h-64 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>shape_id</TableHead>
                  <TableHead className="w-24 text-right">点数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewShapes.map((shape) => (
                  <TableRow key={shape.shapeId}>
                    <TableCell className="max-w-64 truncate font-medium font-mono text-sm">{shape.shapeId}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{shape.points.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {shapes.length > 5 && (
            <p className="text-center text-xs text-muted-foreground">他 {shapes.length - 5} 路線</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center py-8">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-8 text-primary" />
          </div>
          <p className="text-lg font-medium">インポート準備完了</p>
          <p className="text-sm text-muted-foreground">
            {shapes.length}路線（{totalPoints}点）をインポートします
          </p>
          {skipped > 0 && <p className="mt-1 text-xs text-amber-600">（{skipped}件はスキップ）</p>}
        </div>
      )}

      <DialogFooter>
        {step === 1 && <Button variant="outline" onClick={onClose}>キャンセル</Button>}
        {step === 2 && (
          <>
            <Button variant="outline" onClick={reset}>戻る</Button>
            <Button onClick={() => setStep(3)} disabled={shapes.length === 0}>確認</Button>
          </>
        )}
        {step === 3 && (
          <>
            <Button variant="outline" onClick={() => setStep(2)}>戻る</Button>
            <Button onClick={handleImport}>インポート</Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}

export function GtfsImportDialog({
  open,
  onOpenChange,
  onImport,
  onImportShapes,
}: GtfsImportDialogProps) {
  const [activeTab, setActiveTab] = useState<string>('stops')

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) setActiveTab('stops')
      onOpenChange(isOpen)
    },
    [onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>GTFSインポート</DialogTitle>
          <DialogDescription>
            GTFS形式のファイルをアップロードしてデータを一括登録します
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="stops" className="flex-1">stops.txt（バス停）</TabsTrigger>
            <TabsTrigger value="shapes" className="flex-1">shapes.txt（路線形状）</TabsTrigger>
          </TabsList>

          <TabsContent value="stops">
            <StopsTab
              onImport={onImport}
              onClose={() => handleClose(false)}
            />
          </TabsContent>

          <TabsContent value="shapes">
            <ShapesTab
              onImportShapes={onImportShapes}
              onClose={() => handleClose(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
