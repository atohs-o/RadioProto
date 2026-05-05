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
import { ArrowLeft, Save, Upload, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'

interface ProgramEditorProps {
  program: Program
  isNew?: boolean
}

export function ProgramEditor({ program: initialProgram, isNew = false }: ProgramEditorProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [program, setProgram] = useState(initialProgram)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    // TODO: API呼び出しはClaude Codeが実装
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsSaving(false)
    router.push('/programs')
  }

  const handleCSVImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // TODO: CSVインポート処理はClaude Codeが実装
    // スタブとして固定データを設定
    setProgram((prev) => ({
      ...prev,
      routePoints: [
        { lat: 36.3006, lng: 137.8729 },
        { lat: 36.3100, lng: 137.8800 },
        { lat: 36.3234, lng: 137.8821 },
      ],
    }))

    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteItem = (itemId: string) => {
    setProgram((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }))
  }

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex h-full">
      {/* 左側: 地図エリア (60%) */}
      <div className="w-[60%] p-4">
        <div className="h-full w-full rounded-lg border bg-muted flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            地図（Leaflet）がここに入ります
          </p>
        </div>
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

          {/* 路線データ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">路線データ</CardTitle>
              <CardDescription>
                CSVファイルから路線座標をインポートします
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCSVImport}
              >
                <Upload className="mr-2 h-4 w-4" />
                路線データCSVインポート
              </Button>
              {program.routePoints.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {program.routePoints.length}点の座標が登録されています
                </p>
              )}
            </CardContent>
          </Card>

          {/* 紐付けセット一覧 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">紐付けセット一覧</CardTitle>
              <CardDescription>
                位置とコンテンツの紐付けを管理します
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">位置名称</TableHead>
                    <TableHead>コンテンツ</TableHead>
                    <TableHead className="w-[70px] text-right">音声長</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
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
                      <TableRow key={item.id}>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">
                              {item.locationName}を削除
                            </span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

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
    </div>
  )
}
