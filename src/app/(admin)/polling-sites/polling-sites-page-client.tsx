'use client'

import { useState } from 'react'
import { Plus, Trash2, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'

import type { PollingSite } from '@/lib/schemas/polling-sites'
import {
  createPollingSiteAction,
  togglePollingSiteAction,
  deletePollingSiteAction,
} from './actions'

interface Props {
  sites: PollingSite[]
}

function getStatusBadge(status: PollingSite['lastStatus']) {
  switch (status) {
    case 'success':
      return <Badge className="bg-brand-green text-foreground">成功</Badge>
    case 'failure':
      return <Badge variant="destructive">エラー</Badge>
    case 'pending':
      return <Badge variant="secondary">未実行</Badge>
    default:
      return <Badge variant="outline">-</Badge>
  }
}

function formatDateTime(dateString: string | undefined) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PollingSitesPageClient({ sites: initialSites }: Props) {
  const [sites, setSites] = useState<PollingSite[]>(initialSites)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [newSiteName, setNewSiteName] = useState('')
  const [newSiteUrl, setNewSiteUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)))
    const result = await togglePollingSiteAction(id, enabled)
    if (result.error) {
      setSites((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s)))
      setError(result.error)
    }
  }

  const handleAddSite = async () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) return
    const result = await createPollingSiteAction({
      name: newSiteName.trim(),
      url: newSiteUrl.trim(),
    })
    if (result.error) {
      setError(result.error)
      return
    }
    setSites((prev) => [
      ...prev,
      {
        id: result.id!,
        name: newSiteName.trim(),
        url: newSiteUrl.trim(),
        enabled: true,
        lastStatus: 'pending',
      },
    ])
    setNewSiteName('')
    setNewSiteUrl('')
    setIsAddDialogOpen(false)
  }

  const handleDeleteSite = async () => {
    if (!deleteTargetId) return
    const result = await deletePollingSiteAction(deleteTargetId)
    if (result.error) {
      setError(result.error)
    } else {
      setSites((prev) => prev.filter((s) => s.id !== deleteTargetId))
    }
    setDeleteTargetId(null)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            ポーリングサイト管理
          </h1>
          <p className="text-muted-foreground">
            自動取得対象のWebサイトを管理します
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ポーリングサイトを追加</DialogTitle>
              <DialogDescription>
                自動取得対象のWebサイトを登録します
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="site-name">サイト名</FieldLabel>
                <Input
                  id="site-name"
                  placeholder="例: 安曇野市観光協会"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="site-url">URL</FieldLabel>
                <Input
                  id="site-url"
                  type="url"
                  placeholder="https://example.com/news"
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                />
              </Field>
            </FieldGroup>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false)
                  setError(null)
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddSite}
                disabled={!newSiteName.trim() || !newSiteUrl.trim()}
              >
                追加
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && !isAddDialogOpen && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">サイト名</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[100px] text-center">有効</TableHead>
              <TableHead className="w-[180px]">最終取得日時</TableHead>
              <TableHead className="w-[100px] text-center">
                ステータス
              </TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map((site) => (
              <TableRow key={site.id}>
                <TableCell className="font-medium">{site.name}</TableCell>
                <TableCell>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-brand-blue hover:underline"
                  >
                    <span className="max-w-[300px] truncate">{site.url}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={site.enabled}
                    onCheckedChange={(checked) =>
                      handleToggleEnabled(site.id, checked)
                    }
                  />
                </TableCell>
                <TableCell>{formatDateTime(site.lastFetchedAt)}</TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(site.lastStatus)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTargetId(site.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">削除</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sites.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  ポーリングサイトが登録されていません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>サイトを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。ポーリングサイトを削除すると、関連する取得履歴も失われる可能性があります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
