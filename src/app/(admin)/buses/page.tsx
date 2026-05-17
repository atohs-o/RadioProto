'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import useSWR from 'swr'
import { Plus, Eye, Ban, Tv, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState } from '@/components/common/error-state'
import type { Bus } from '@/types'

type ProgramSummary = { id: string; name: string; enabled: boolean }

async function fetchBuses(): Promise<Bus[]> {
  const res = await fetch('/api/admin/buses')
  if (!res.ok) throw new Error('バス一覧の取得に失敗しました')
  return res.json() as Promise<Bus[]>
}

async function fetchPrograms(): Promise<ProgramSummary[]> {
  const res = await fetch('/api/admin/programs')
  if (!res.ok) throw new Error('番組一覧の取得に失敗しました')
  return res.json() as Promise<ProgramSummary[]>
}

function maskToken(token: string): string {
  if (token.length <= 8) return '****'
  return '****' + token.slice(-4)
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BusesPage() {
  const { data: buses, isLoading, error, mutate } = useSWR<Bus[]>('buses', fetchBuses)
  const { data: programs } = useSWR<ProgramSummary[]>('admin-programs', fetchPrograms)

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState('')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [busToDisable, setBusToDisable] = useState<Bus | null>(null)
  const [setProgramDialogOpen, setSetProgramDialogOpen] = useState(false)
  const [busForProgram, setBusForProgram] = useState<Bus | null>(null)
  const [imageUploadDialogOpen, setImageUploadDialogOpen] = useState(false)
  const [busForImage, setBusForImage] = useState<Bus | null>(null)

  const handleShowToken = (token: string) => {
    setSelectedToken(token)
    setIsTokenDialogOpen(true)
  }

  const handleDisableClick = (bus: Bus) => {
    setBusToDisable(bus)
    setConfirmDialogOpen(true)
  }

  const handleConfirmDisable = async () => {
    if (!busToDisable) return
    try {
      const res = await fetch(`/api/admin/buses/${busToDisable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      })
      if (!res.ok) throw new Error()
      await mutate()
      toast.success(`${busToDisable.busName}を無効化しました`)
    } catch {
      toast.error('無効化に失敗しました')
    } finally {
      setConfirmDialogOpen(false)
      setBusToDisable(null)
    }
  }

  const handleSetProgramClick = (bus: Bus) => {
    setBusForProgram(bus)
    setSetProgramDialogOpen(true)
  }

  const handleImageClick = (bus: Bus) => {
    setBusForImage(bus)
    setImageUploadDialogOpen(true)
  }

  const programNameById = (id: string | null) => {
    if (!id || !programs) return '未設定'
    return programs.find((p) => p.id === id)?.name ?? '未設定'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">バス管理</h1>
          <p className="text-muted-foreground">
            車両とデバイストークンを管理します
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          バスを追加
        </Button>
      </div>

      {error ? (
        <ErrorState retry={() => mutate()} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">バスコード</TableHead>
                <TableHead>バス名</TableHead>
                <TableHead className="w-28">ナンバープレート</TableHead>
                <TableHead className="w-36">番組</TableHead>
                <TableHead className="w-24">デバイストークン</TableHead>
                <TableHead className="w-36">最終接続日時</TableHead>
                <TableHead className="w-20">ステータス</TableHead>
                <TableHead className="w-64 text-right sticky right-0 bg-background">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buses?.map((bus) => (
                <TableRow key={bus.id}>
                  <TableCell className="font-medium">{bus.busCode}</TableCell>
                  <TableCell className="overflow-hidden">
                    <span className="truncate block">{bus.busName}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {bus.plateNumber ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm overflow-hidden">
                    <span className="truncate block">
                      {programNameById(bus.currentProgramId)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {maskToken(bus.deviceToken)}
                  </TableCell>
                  <TableCell>{formatDate(bus.lastConnectedAt)}</TableCell>
                  <TableCell>
                    <Badge variant={bus.enabled ? 'default' : 'secondary'}>
                      {bus.enabled ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right sticky right-0 bg-background">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetProgramClick(bus)}
                      >
                        <Tv className="mr-1 size-4" />
                        番組をセット
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImageClick(bus)}
                      >
                        <ImageIcon className="mr-1 size-4" />
                        画像
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShowToken(bus.deviceToken)}
                      >
                        <Eye className="mr-1 size-4" />
                        トークン
                      </Button>
                      {bus.enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisableClick(bus)}
                        >
                          <Ban className="mr-1 size-4" />
                          無効化
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddBusDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => mutate()}
      />

      <Dialog open={isTokenDialogOpen} onOpenChange={setIsTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>デバイストークン</DialogTitle>
            <DialogDescription>
              このトークンは機密情報です。安全に管理してください。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-4">
            <code className="text-sm break-all">{selectedToken}</code>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsTokenDialogOpen(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="バスを無効化しますか？"
        description={`${busToDisable?.busName}（${busToDisable?.busCode}）を無効化します。無効化されたバスはシステムに接続できなくなります。`}
        confirmLabel="無効化"
        variant="destructive"
        onConfirm={handleConfirmDisable}
      />

      <SetProgramDialog
        open={setProgramDialogOpen}
        onOpenChange={setSetProgramDialogOpen}
        bus={busForProgram}
        programs={programs ?? []}
        onSuccess={() => mutate()}
      />

      <ImageUploadDialog
        open={imageUploadDialogOpen}
        onOpenChange={setImageUploadDialogOpen}
        bus={busForImage}
        onSuccess={() => mutate()}
      />
    </div>
  )
}

function AddBusDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [busCode, setBusCode] = useState('')
  const [busName, setBusName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!busCode.trim() || !busName.trim()) {
      toast.error('すべてのフィールドを入力してください')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/admin/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busCode, busName }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'エラー')
      }
      toast.success('バスを追加しました')
      setBusCode('')
      setBusName('')
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'バスの追加に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>バスを追加</DialogTitle>
          <DialogDescription>
            新しいバスを登録します。デバイストークンは自動生成されます。
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="space-y-4">
          <Field>
            <FieldLabel htmlFor="busCode">バスコード</FieldLabel>
            <Input
              id="busCode"
              value={busCode}
              onChange={(e) => setBusCode(e.target.value)}
              placeholder="例: BUS-004"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="busName">バス名</FieldLabel>
            <Input
              id="busName"
              value={busName}
              onChange={(e) => setBusName(e.target.value)}
              placeholder="例: 安曇野東ルート1号車"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Spinner className="mr-2 size-4" />}
            追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SetProgramDialog({
  open,
  onOpenChange,
  bus,
  programs,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bus: Bus | null
  programs: ProgramSummary[]
  onSuccess: () => void
}) {
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen && bus) setSelectedProgramId(bus.currentProgramId ?? '')
    onOpenChange(nextOpen)
  }

  const handleSave = async () => {
    if (!bus) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/buses/${bus.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          currentProgramId: selectedProgramId || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('番組を設定しました')
      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error('番組の設定に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>番組をセット</DialogTitle>
          <DialogDescription>
            {bus?.busName}（{bus?.busCode}）に割り当てる番組を選択してください。
          </DialogDescription>
        </DialogHeader>
        <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
          <SelectTrigger>
            <SelectValue placeholder="番組を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">番組なし</SelectItem>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Spinner className="mr-2 size-4" />}
            設定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImageUploadDialog({
  open,
  onOpenChange,
  bus,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bus: Bus | null
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setFile(null)
    onOpenChange(nextOpen)
  }

  const handleUpload = async () => {
    if (!bus || !file) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`/api/admin/buses/${bus.id}/image`, {
        method: 'PUT',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'エラー')
      }
      toast.success('画像を更新しました')
      onSuccess()
      handleOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>バス画像を変更</DialogTitle>
          <DialogDescription>
            {bus?.busName}（{bus?.busCode}）の画像をアップロードします。JPEG / PNG / WebP、5MB 以下。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:bg-muted file:text-foreground hover:file:bg-muted/80"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="text-sm text-muted-foreground">{file.name}（{(file.size / 1024).toFixed(0)} KB）</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading && <Spinner className="mr-2 size-4" />}
            アップロード
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
