'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, SearchIcon, FolderIcon, PencilIcon, TrashIcon } from 'lucide-react'
import type { ContentGroup } from '@/lib/schemas/content-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  createContentGroupAction,
  updateContentGroupAction,
  deleteContentGroupAction,
} from './actions'

interface ContentsPageClientProps {
  groups: ContentGroup[]
}

export function ContentsPageClient({ groups: initialGroups }: ContentsPageClientProps) {
  const router = useRouter()
  const [groups, setGroups] = useState(initialGroups)
  const [searchQuery, setSearchQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ContentGroup | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allTags = Array.from(new Set(groups.flatMap((g) => g.tags)))

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      searchQuery === '' || g.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTag = tagFilter === '' || g.tags.includes(tagFilter)
    return matchesSearch && matchesTag
  })

  const handleCreate = async (name: string, description: string, tagsCsv: string) => {
    const result = await createContentGroupAction({ name, description, tags_csv: tagsCsv })
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }
    setCreateOpen(false)
    router.refresh()
  }

  const handleUpdate = async (id: string, name: string, description: string, tagsCsv: string) => {
    const result = await updateContentGroupAction(id, { name, description, tags_csv: tagsCsv })
    if (result.error) {
      setError(result.error)
      return
    }
    setEditTarget(null)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    const result = await deleteContentGroupAction(id)
    if (result.error) {
      setError(result.error)
      return
    }
    setGroups((prev) => prev.filter((g) => g.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="mr-2 size-4" />
          新規グループ作成
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="グループ名を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={tagFilter === '' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setTagFilter('')}
            >
              すべて
            </Badge>
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={tagFilter === tag ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setTagFilter(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <FolderIcon className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">グループがありません</p>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="mr-2 size-4" />
            グループを作成する
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onClick={() => router.push(`/contents/${group.id}`)}
              onEdit={() => setEditTarget(group)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <GroupFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新規グループ作成"
        onSubmit={(name, description, tagsCsv) => handleCreate(name, description, tagsCsv)}
      />

      {editTarget && (
        <GroupFormDialog
          open={!!editTarget}
          onOpenChange={(open) => { if (!open) setEditTarget(null) }}
          title="グループを編集"
          initialName={editTarget.name}
          initialDescription={editTarget.description ?? ''}
          initialTagsCsv={editTarget.tags.join(', ')}
          onSubmit={(name, description, tagsCsv) =>
            handleUpdate(editTarget.id, name, description, tagsCsv)
          }
        />
      )}
    </div>
  )
}

function GroupCard({
  group,
  onClick,
  onEdit,
  onDelete,
}: {
  group: ContentGroup
  onClick: () => void
  onEdit: () => void
  onDelete: (id: string) => void
}) {
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {group.name}
          </CardTitle>
          <div
            className="flex shrink-0 gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onEdit}
            >
              <PencilIcon className="size-4" />
              <span className="sr-only">編集</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                >
                  <TrashIcon className="size-4" />
                  <span className="sr-only">削除</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>グループを削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    グループを削除します。コンテンツは削除されません（グループ未設定になります）。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(group.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    削除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {group.description && (
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
            {group.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{group.contentCount} コンテンツ</Badge>
          {group.tags.map((tag) => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {new Date(group.createdAt).toLocaleDateString('ja-JP')}
        </p>
      </CardContent>
    </Card>
  )
}

function GroupFormDialog({
  open,
  onOpenChange,
  title,
  initialName = '',
  initialDescription = '',
  initialTagsCsv = '',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initialName?: string
  initialDescription?: string
  initialTagsCsv?: string
  onSubmit: (name: string, description: string, tagsCsv: string) => void
}) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [tagsCsv, setTagsCsv] = useState(initialTagsCsv)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit(name.trim(), description.trim(), tagsCsv.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">グループ名 *</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 観光スポット案内"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-description">説明</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="グループの説明（任意）"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-tags">タグ（カンマ区切り）</Label>
            <Input
              id="group-tags"
              value={tagsCsv}
              onChange={(e) => setTagsCsv(e.target.value)}
              placeholder="例: 観光, 案内, 春"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
