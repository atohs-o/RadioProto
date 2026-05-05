'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PlusIcon, SearchIcon, PencilIcon, TrashIcon } from 'lucide-react'
import type { Content } from '@/lib/schemas/content'
import { deleteContent } from '@/lib/api/contents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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

interface ContentsTableProps {
  initialContents: Content[]
}

const SOURCE_TYPE_LABELS: Record<Content['sourceType'], string> = {
  polling: 'ポーリング',
  manual: '手動入力',
  url: 'URL取得',
}

const AUDIO_STATUS_LABELS: Record<Content['audioStatus'], string> = {
  pending: '未生成',
  generating: '生成中',
  generated: '生成済み',
  error: 'エラー',
}

const AUDIO_STATUS_VARIANTS: Record<
  Content['audioStatus'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'secondary',
  generating: 'outline',
  generated: 'default',
  error: 'destructive',
}

export function ContentsTable({ initialContents }: ContentsTableProps) {
  const [contents, setContents] = useState<Content[]>(initialContents)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all')

  const filteredContents = useMemo(() => {
    return contents.filter((content) => {
      const matchesKeyword =
        searchKeyword === '' ||
        content.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        content.summary?.toLowerCase().includes(searchKeyword.toLowerCase())

      const matchesSourceType =
        sourceTypeFilter === 'all' || content.sourceType === sourceTypeFilter

      return matchesKeyword && matchesSourceType
    })
  }, [contents, searchKeyword, sourceTypeFilter])

  const handleDelete = async (id: string) => {
    await deleteContent(id)
    setContents((prev) => prev.filter((c) => c.id !== id))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="キーワードで検索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="ソース種別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="polling">ポーリング</SelectItem>
            <SelectItem value="manual">手動入力</SelectItem>
            <SelectItem value="url">URL取得</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button asChild>
            <Link href="/contents/new">
              <PlusIcon className="mr-2 h-4 w-4" />
              新規作成
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">タイトル</TableHead>
              <TableHead className="w-[120px]">ソース</TableHead>
              <TableHead className="w-[100px]">音声</TableHead>
              <TableHead className="w-[100px]">ラジオ登録</TableHead>
              <TableHead className="w-[120px]">更新日</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  コンテンツがありません
                </TableCell>
              </TableRow>
            ) : (
              filteredContents.map((content) => (
                <TableRow key={content.id}>
                  <TableCell>
                    <Link
                      href={`/contents/${content.id}`}
                      className="font-medium hover:underline"
                    >
                      {content.title}
                    </Link>
                    {content.summary && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                        {content.summary}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {SOURCE_TYPE_LABELS[content.sourceType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={AUDIO_STATUS_VARIANTS[content.audioStatus]}>
                      {AUDIO_STATUS_LABELS[content.audioStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={content.radioRegistered ? 'default' : 'secondary'}
                    >
                      {content.radioRegistered ? '登録済み' : '未登録'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(content.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/contents/${content.id}`}>
                          <PencilIcon className="h-4 w-4" />
                          <span className="sr-only">編集</span>
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <TrashIcon className="h-4 w-4 text-destructive" />
                            <span className="sr-only">削除</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              コンテンツを削除しますか？
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              「{content.title}」を削除します。この操作は取り消せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(content.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        {filteredContents.length} 件のコンテンツ
      </p>
    </div>
  )
}
