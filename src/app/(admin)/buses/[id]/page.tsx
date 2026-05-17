'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import useSWR from 'swr'
import { ArrowLeft, Ban, CheckCircle, Eye, ImageIcon, Tv } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState } from '@/components/common/error-state'
import type { Bus } from '@/types'

type ProgramSummary = { id: string; name: string; enabled: boolean }

async function fetchBus(id: string): Promise<Bus> {
  const res = await fetch(`/api/admin/buses/${id}`)
  if (!res.ok) throw new Error('バス情報の取得に失敗しました')
  return res.json() as Promise<Bus>
}

async function fetchPrograms(): Promise<ProgramSummary[]> {
  const res = await fetch('/api/admin/programs')
  if (!res.ok) throw new Error()
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

export default function BusDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: bus, isLoading, error, mutate } = useSWR<Bus>(
    `bus-${id}`,
    () => fetchBus(id),
  )
  const { data: programs } = useSWR<ProgramSummary[]>('admin-programs', fetchPrograms)

  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false)
  const [setProgramDialogOpen, setSetProgramDialogOpen] = useState(false)
  const [imageUploadDialogOpen, setImageUploadDialogOpen] = useState(false)
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false)
  const [confirmEnableOpen, setConfirmEnableOpen] = useState(false)

  const programName = bus?.currentProgramId
    ? (programs?.find((p) => p.id === bus.currentProgramId)?.name ?? '読み込み中…')
    : '未設定'

  const handleToggleEnable = async () => {
    if (!bus) return
    const action = bus.enabled ? 'disable' : 'enable'
    try {
      const res = await fetch(`/api/admin/buses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
      await mutate()
      toast.success(action === 'disable' ? '無効化しました' : '有効化しました')
    } catch {
      toast.error('更新に失敗しました')
    } finally {
      setConfirmDisableOpen(false)
      setConfirmEnableOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error || !bus) {
    return <ErrorState retry={() => mutate()} />
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/buses"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-4" />
          バス一覧
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{bus.busCode}</h1>
        <p className="text-muted-foreground">{bus.busName}</p>
      </div>

      {/* 基本情報 */}
      <BasicInfoCard id={id} bus={bus} onSaved={() => mutate()} />

      {/* バス画像 */}
      <ImageCard
        id={id}
        imageUrl={bus.imageUrl}
        open={imageUploadDialogOpen}
        onOpenChange={setImageUploadDialogOpen}
        onSaved={() => mutate()}
      />

      {/* 番組設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">番組設定</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">現在の番組</p>
            <p className="font-medium">{programName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSetProgramDialogOpen(true)}>
            <Tv className="mr-2 size-4" />
            変更
          </Button>
        </CardContent>
      </Card>

      {/* デバイス情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">デバイス情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">ステータス</p>
              <Badge className="mt-1" variant={bus.enabled ? 'default' : 'secondary'}>
                {bus.enabled ? '有効' : '無効'}
              </Badge>
            </div>
            {bus.enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDisableOpen(true)}
              >
                <Ban className="mr-2 size-4" />
                無効化
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmEnableOpen(true)}
              >
                <CheckCircle className="mr-2 size-4" />
                有効化
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">デバイストークン</p>
              <p className="font-mono text-sm">{maskToken(bus.deviceToken)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsTokenDialogOpen(true)}>
              <Eye className="mr-2 size-4" />
              表示
            </Button>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">最終接続日時</p>
            <p className="text-sm">{formatDate(bus.lastConnectedAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* トークン表示ダイアログ */}
      <Dialog open={isTokenDialogOpen} onOpenChange={setIsTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>デバイストークン</DialogTitle>
            <DialogDescription>
              このトークンは機密情報です。安全に管理してください。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-4">
            <code className="text-sm break-all">{bus.deviceToken}</code>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsTokenDialogOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 番組設定ダイアログ */}
      <SetProgramDialog
        open={setProgramDialogOpen}
        onOpenChange={setSetProgramDialogOpen}
        busId={id}
        currentProgramId={bus.currentProgramId}
        programs={programs ?? []}
        onSuccess={() => mutate()}
      />

      {/* 無効化確認 */}
      <ConfirmDialog
        open={confirmDisableOpen}
        onOpenChange={setConfirmDisableOpen}
        title="バスを無効化しますか？"
        description={`${bus.busName}（${bus.busCode}）を無効化します。無効化されたバスはシステムに接続できなくなります。`}
        confirmLabel="無効化"
        variant="destructive"
        onConfirm={handleToggleEnable}
      />

      {/* 有効化確認 */}
      <ConfirmDialog
        open={confirmEnableOpen}
        onOpenChange={setConfirmEnableOpen}
        title="バスを有効化しますか？"
        description={`${bus.busName}（${bus.busCode}）を有効化します。`}
        confirmLabel="有効化"
        variant="default"
        onConfirm={handleToggleEnable}
      />
    </div>
  )
}

function BasicInfoCard({
  id,
  bus,
  onSaved,
}: {
  id: string
  bus: Bus
  onSaved: () => void
}) {
  const [busName, setBusName] = useState(bus.busName)
  const [plateNumber, setPlateNumber] = useState(bus.plateNumber ?? '')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setBusName(bus.busName)
    setPlateNumber(bus.plateNumber ?? '')
  }, [bus.busName, bus.plateNumber])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/buses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          busName: busName.trim(),
          plateNumber: plateNumber.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('保存しました')
      onSaved()
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">基本情報</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup className="space-y-4">
          <Field>
            <FieldLabel>バスコード</FieldLabel>
            <Input value={bus.busCode} readOnly className="bg-muted text-muted-foreground" />
          </Field>
          <Field>
            <FieldLabel htmlFor="busName">バス名</FieldLabel>
            <Input
              id="busName"
              value={busName}
              onChange={(e) => setBusName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="plateNumber">ナンバープレート</FieldLabel>
            <Input
              id="plateNumber"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="例: 品川 500 あ 1234"
            />
          </Field>
        </FieldGroup>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Spinner className="mr-2 size-4" />}
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ImageCard({
  id,
  imageUrl,
  open,
  onOpenChange,
  onSaved,
}: {
  id: string
  imageUrl: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { data: signedUrlData } = useSWR<{ signedUrl: string }>(
    imageUrl ? `bus-image-${id}` : null,
    () => fetch(`/api/admin/buses/${id}/image`).then((r) => r.json() as Promise<{ signedUrl: string }>),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">バス画像</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <div className="size-24 rounded-md border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {signedUrlData?.signedUrl ? (
            <img
              src={signedUrlData.signedUrl}
              alt="バス画像"
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
          <ImageIcon className="mr-2 size-4" />
          画像を変更
        </Button>
      </CardContent>

      <ImageUploadDialog
        open={open}
        onOpenChange={onOpenChange}
        busId={id}
        busName=""
        onSuccess={onSaved}
      />
    </Card>
  )
}

function SetProgramDialog({
  open,
  onOpenChange,
  busId,
  currentProgramId,
  programs,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busId: string
  currentProgramId: string | null
  programs: ProgramSummary[]
  onSuccess: () => void
}) {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(currentProgramId ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) setSelectedProgramId(currentProgramId ?? '')
    onOpenChange(nextOpen)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/buses/${busId}`, {
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
            割り当てる番組を選択してください。
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
  busId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busId: string
  busName: string
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setFile(null)
    onOpenChange(nextOpen)
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`/api/admin/buses/${busId}/image`, {
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
            JPEG / PNG / WebP、5MB 以下の画像をアップロードしてください。
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
            <p className="text-sm text-muted-foreground">
              {file.name}（{(file.size / 1024).toFixed(0)} KB）
            </p>
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
