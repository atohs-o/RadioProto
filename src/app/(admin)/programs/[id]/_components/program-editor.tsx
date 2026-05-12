'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Program } from '@/lib/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft, Save, Trash2, Pencil, MapPin, X } from 'lucide-react'
import Link from 'next/link'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import Map from '@/components/map/map'
import type { MapMarker } from '@/components/map/map'
import { ContentSelectDialog } from './content-select-dialog'
import { GtfsImportDialog } from './gtfs-import-dialog'
import { saveProgramAction } from '../../actions'
import { type GTFSStop, type GTFSShape } from '@/lib/csv'

interface GeneratedContent {
  id: string
  title: string
  audioDurationSec?: number
}

interface ProgramEditorProps {
  program: Program
  isNew?: boolean
  generatedContents: GeneratedContent[]
}

interface EditingItemInfo {
  id: string
  contentId: string
  locationName: string
  position: { lat: number; lng: number }
}

export function ProgramEditor({
  program: initialProgram,
  isNew = false,
  generatedContents,
}: ProgramEditorProps) {
  const router = useRouter()
  const [program, setProgram] = useState<Program>(initialProgram)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingPosition, setPendingPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<EditingItemInfo | null>(null)
  const [isRelocating, setIsRelocating] = useState(false)
  const [gtfsDialogOpen, setGtfsDialogOpen] = useState(false)
  const [shapes, setShapes] = useState<GTFSShape[]>(initialProgram.shapes ?? [])
  const [importedStops, setImportedStops] = useState<GTFSStop[]>([])
  // ref でクロージャの stale 問題を回避（handleDialogOpenChange が isRelocating を参照するため）
  const isRelocatingRef = useRef(false)

  const mapCenter =
    importedStops[0]
      ? { lat: importedStops[0].lat, lng: importedStops[0].lng }
      : program.items[0]?.position ?? { lat: 36.3006, lng: 137.8729 }

  const markers: MapMarker[] = program.items.map((item) => ({
    id: item.id,
    position: item.position,
    label: item.locationName,
    color: 'blue',
  }))

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    const result = await saveProgramAction({ ...program, shapes }, isNew)
    if (result.error) {
      setSaveError(result.error)
      setIsSaving(false)
      return
    }
    router.push('/programs')
  }

  const handleStopsImport = (stops: GTFSStop[]) => {
    setImportedStops(stops)
  }

  const handleShapesImport = (imported: GTFSShape[]) => {
    setShapes(imported)
  }

  const handleDeleteItem = (itemId: string) => {
    setProgram((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }))
    if (selectedMarkerId === itemId) {
      setSelectedMarkerId(null)
    }
  }

  const handleAddItem = (item: {
    contentId: string
    contentTitle: string
    audioDurationSec: number
    locationName: string
    position: { lat: number; lng: number }
  }) => {
    setProgram((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: crypto.randomUUID(),
          position: item.position,
          locationName: item.locationName,
          contentId: item.contentId,
          contentTitle: item.contentTitle,
          audioDurationSec: item.audioDurationSec,
        },
      ],
    }))
  }

  const handleEditItem = (itemId: string) => {
    const item = program.items.find((i) => i.id === itemId)
    if (!item) return
    setEditingItem({
      id: item.id,
      contentId: item.contentId,
      locationName: item.locationName,
      position: item.position,
    })
    setDialogOpen(true)
  }

  const handleUpdateItem = (update: {
    id: string
    contentId: string
    contentTitle: string
    audioDurationSec: number
    locationName: string
    position: { lat: number; lng: number }
  }) => {
    setProgram((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === update.id ? { ...item, ...update } : item
      ),
    }))
    setEditingItem(null)
  }

  const handleRequestMapReselect = () => {
    isRelocatingRef.current = true
    setIsRelocating(true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      if (isRelocatingRef.current) {
        return
      }
      setEditingItem(null)
      setPendingPosition(null)
    }
  }

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex h-full">
      {/* 左側: 地図エリア (60%) */}
      <div className="relative w-[60%] h-full p-4">
        {isRelocating && (
          <div className="absolute top-8 left-1/2 z-[1000] -translate-x-1/2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground shadow">
            地図をクリックして新しい位置を選択してください
          </div>
        )}
        <Map
          center={mapCenter}
          zoom={14}
          routePoints={program.routePoints}
          shapePolylines={shapes.map((s) => ({ points: s.points }))}
          stopMarkers={importedStops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.stopName }))}
          markers={markers}
          selectedMarkerId={selectedMarkerId}
          showSearch
          onMapClick={(pos) => {
            if (isRelocatingRef.current && editingItem) {
              isRelocatingRef.current = false
              setIsRelocating(false)
              setEditingItem((prev) => (prev ? { ...prev, position: pos } : null))
              setDialogOpen(true)
            } else {
              setPendingPosition(pos)
              setDialogOpen(true)
            }
          }}
          onMarkerClick={(id) =>
            setSelectedMarkerId((prev) => (prev === id ? null : id))
          }
          className="rounded-lg border"
        />
      </div>

      {/* 右側: 設定パネル (40%) */}
      <div className="w-[40%] border-l bg-background overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {/* ヘッダー */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/programs">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">戻る</span>
              </Link>
            </Button>
            <h1 className="text-xl font-bold">
              {isNew ? '番組を作成' : '番組を編集'}
            </h1>
          </div>

          {/* 基本設定 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">基本設定</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="program-name">番組名</FieldLabel>
                  <Input
                    id="program-name"
                    value={program.name}
                    onChange={(e) =>
                      setProgram((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="番組名を入力"
                  />
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="program-enabled">有効/無効</Label>
                    <Switch
                      id="program-enabled"
                      checked={program.enabled}
                      onCheckedChange={(checked) =>
                        setProgram((prev) => ({ ...prev, enabled: checked }))
                      }
                    />
                  </div>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* GTFSインポート */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">GTFSインポート</CardTitle>
              <CardDescription>
                shapes.txt で路線形状、stops.txt でバス停をインポートします
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setGtfsDialogOpen(true)}
              >
                <MapPin className="mr-2 h-4 w-4" />
                GTFSデータをインポート
              </Button>
            </CardContent>
          </Card>

          {/* バス停一覧 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">バス停一覧</CardTitle>
                  <CardDescription className="mt-1">
                    stops.txt からインポートしたバス停（地図上に灰色で表示）
                  </CardDescription>
                </div>
                {importedStops.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => setImportedStops([])}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">バス停をクリア</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {importedStops.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                  バス停がインポートされていません
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4 w-10">#</TableHead>
                        <TableHead>停留所名</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedStops.map((stop, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-4 text-muted-foreground tabular-nums text-sm">
                            {i + 1}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {stop.stopName}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 紐付けセット一覧 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">紐付けセット一覧</CardTitle>
              <CardDescription>
                地図をクリックしてピンを追加し、コンテンツと紐付けます
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">位置名称</TableHead>
                    <TableHead>コンテンツ</TableHead>
                    <TableHead className="w-[70px] text-right">音声長</TableHead>
                    <TableHead className="w-[90px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {program.items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-16 text-center text-muted-foreground"
                      >
                        紐付けがありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    program.items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer ${item.id === selectedMarkerId ? 'bg-muted' : ''}`}
                        onClick={() =>
                          setSelectedMarkerId((prev) =>
                            prev === item.id ? null : item.id
                          )
                        }
                      >
                        <TableCell className="pl-4 font-medium">
                          {item.locationName}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                          {item.contentTitle}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatDuration(item.audioDurationSec)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditItem(item.id)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">
                                {item.locationName}を編集
                              </span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteItem(item.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">
                                {item.locationName}を削除
                              </span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          {/* 保存ボタン */}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving || !program.name.trim()}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      <GtfsImportDialog
        open={gtfsDialogOpen}
        onOpenChange={setGtfsDialogOpen}
        onImport={handleStopsImport}
        onImportShapes={handleShapesImport}
      />

      <ContentSelectDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        clickedPosition={pendingPosition}
        contents={generatedContents}
        editingItem={editingItem}
        onConfirm={handleAddItem}
        onUpdate={handleUpdateItem}
        onRequestMapReselect={handleRequestMapReselect}
      />
    </div>
  )
}
