'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PlusIcon, PencilIcon, TrashIcon, SearchIcon } from 'lucide-react'
import type { Content } from '@/lib/schemas/content'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { deleteContentAction } from '../actions'

const SOURCE_TYPE_LABELS: Record<Content['sourceType'], string> = {
  polling: 'ポーリング',
  manual: '手動',
  url: 'URL',
}

const AUDIO_STATUS_LABELS: Record<Content['audioStatus'], string> = {
  pending: '未生成',
  generating: '生成中',
  generated: '生成済み',
  error: 'エラー',
}

const AUDIO_STATUS_VARIANTS: Record<Content['audioStatus'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  generating: 'outline',
  generated: 'default',
  error: 'destructive',
}

interface ContentsGroupPageClientProps {
  contents: Content[]
  groupId: string
}

export function ContentsGroupPageClient({ contents, groupId }: ContentsGroupPageClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filteredContents = contents.filter((content) => {
    const matchesSearch =
      searchQuery === '' ||
      content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.summary?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSource = sourceFilter === 'all' || content.sourceType === sourceFilter
    const matchesStatus = statusFilter === 'all' || content.audioStatus === statusFilter
    return matchesSearch && matchesSource && matchesStatus
  })

  const handleDelete = async (id: string) => {
    const result = await deleteContentAction(id)
    if (result.error) setDeleteError(result.error)
  }

  return (
    <div className="flex flex-col gap-6">
      {deleteError && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild>
          <Link href={`/contents/${groupId}/new`}>
            <PlusIcon className="mr-2 size-4" />
            新規コンテンツ作成
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="キーワード検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="ソース" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのソース</SelectItem>
              <SelectItem value="polling">ポーリング</SelectItem>
              <SelectItem value="manual">手動</SelectItem>
              <SelectItem value="url">URL</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのステータス</SelectItem>
              <SelectItem value="pending">未生成</SelectItem>
              <SelectItem value="generating">生成中</SelectItem>
              <SelectItem value="generated">生成済み</SelectItem>
              <SelectItem value="error">エラー</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        {filteredContents.map((content) => (
          <ContentCard
            key={content.id}
            content={content}
            groupId={groupId}
            onDelete={handleDelete}
          />
        ))}
        {filteredContents.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            コンテンツが見つかりません
          </p>
        )}
      </div>

      <div className="hidden md:block">
        <ContentsTable
          contents={filteredContents}
          groupId={groupId}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}

function ContentCard({
  content,
  groupId,
  onDelete,
}: {
  content: Content
  groupId: string
  onDelete: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {content.title}
          </CardTitle>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" asChild className="size-8">
              <Link href={`/contents/${groupId}/${content.id}`}>
                <PencilIcon className="size-4" />
                <span className="sr-only">編集</span>
              </Link>
            </Button>
            <DeleteButton id={content.id} onDelete={onDelete} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {content.summary && (
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
            {content.summary}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{SOURCE_TYPE_LABELS[content.sourceType]}</Badge>
          <Badge variant={AUDIO_STATUS_VARIANTS[content.audioStatus]}>
            {AUDIO_STATUS_LABELS[content.audioStatus]}
          </Badge>
          {content.radioRegistered && <Badge variant="secondary">登録済み</Badge>}
        </div>
      </CardContent>
    </Card>
  )
}

function ContentsTable({
  contents,
  groupId,
  onDelete,
}: {
  contents: Content[]
  groupId: string
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-lg border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>タイトル</TableHead>
            <TableHead className="w-24">ソース</TableHead>
            <TableHead className="w-24">音声</TableHead>
            <TableHead className="w-24">ラジオ登録</TableHead>
            <TableHead className="w-28">更新日</TableHead>
            <TableHead className="w-20 sticky right-0 bg-background">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contents.map((content) => (
            <TableRow key={content.id}>
              <TableCell className="overflow-hidden">
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{content.title}</span>
                  {content.summary && (
                    <span className="text-sm text-muted-foreground truncate">
                      {content.summary}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{SOURCE_TYPE_LABELS[content.sourceType]}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={AUDIO_STATUS_VARIANTS[content.audioStatus]}>
                  {AUDIO_STATUS_LABELS[content.audioStatus]}
                </Badge>
              </TableCell>
              <TableCell>
                {content.radioRegistered ? (
                  <Badge variant="secondary">登録済み</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {content.updatedAt}
              </TableCell>
              <TableCell className="sticky right-0 bg-background">
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" asChild className="size-8">
                    <Link href={`/contents/${groupId}/${content.id}`}>
                      <PencilIcon className="size-4" />
                      <span className="sr-only">編集</span>
                    </Link>
                  </Button>
                  <DeleteButton id={content.id} onDelete={onDelete} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {contents.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                コンテンツが見つかりません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function DeleteButton({
  id,
  onDelete,
}: {
  id: string
  onDelete: (id: string) => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive">
          <TrashIcon className="size-4" />
          <span className="sr-only">削除</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>コンテンツを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。コンテンツとそれに関連するデータが完全に削除されます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            削除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
