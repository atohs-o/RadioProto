'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import useSWR from 'swr'
import { Plus, Eye, Ban } from 'lucide-react'
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
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { getBuses, createBus, disableBus } from '@/lib/stubs'
import type { Bus } from '@/types'

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
  const { data: buses, isLoading, mutate } = useSWR<Bus[]>('buses', getBuses)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState('')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [busToDisable, setBusToDisable] = useState<Bus | null>(null)

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
      await disableBus(busToDisable.id)
      await mutate()
      toast.success(`${busToDisable.busName}を無効化しました`)
    } catch {
      toast.error('無効化に失敗しました')
    } finally {
      setConfirmDialogOpen(false)
      setBusToDisable(null)
    }
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>バスコード</TableHead>
                <TableHead>バス名</TableHead>
                <TableHead>デバイストークン</TableHead>
                <TableHead>最終接続日時</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buses?.map((bus) => (
                <TableRow key={bus.id}>
                  <TableCell className="font-medium">{bus.busCode}</TableCell>
                  <TableCell>{bus.busName}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {maskToken(bus.deviceToken)}
                  </TableCell>
                  <TableCell>{formatDate(bus.lastConnectedAt)}</TableCell>
                  <TableCell>
                    <Badge variant={bus.enabled ? 'default' : 'secondary'}>
                      {bus.enabled ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShowToken(bus.deviceToken)}
                      >
                        <Eye className="mr-1 size-4" />
                        トークンを表示
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

      {/* Add Bus Dialog */}
      <AddBusDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => mutate()}
      />

      {/* Token Display Dialog */}
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

      {/* Confirm Disable Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="バスを無効化しますか？"
        description={`${busToDisable?.busName}（${busToDisable?.busCode}）を無効化します。無効化されたバスはシステムに接続できなくなります。`}
        confirmLabel="無効化"
        variant="destructive"
        onConfirm={handleConfirmDisable}
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
      await createBus({ busCode, busName })
      toast.success('バスを追加しました')
      setBusCode('')
      setBusName('')
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('バスの追加に失敗しました')
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
