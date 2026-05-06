'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react'
import type { Program } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { updateProgramEnabledAction, deleteProgramAction } from './actions'

interface ProgramsPageClientProps {
  programs: Program[]
}

export function ProgramsPageClient({ programs: initialPrograms }: ProgramsPageClientProps) {
  const [programs, setPrograms] = useState(initialPrograms)

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    await updateProgramEnabledAction(id, enabled)
    setPrograms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled } : p))
    )
  }

  const handleDelete = async (id: string) => {
    await deleteProgramAction(id)
    setPrograms((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ヘッダー部 */}
      <div className="flex items-center justify-between">
        <Button asChild>
          <Link href="/programs/new">
            <PlusIcon className="mr-2 size-4" />
            新規作成
          </Link>
        </Button>
      </div>

      {/* モバイル: カード表示 */}
      <div className="flex flex-col gap-4 md:hidden">
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            onToggleEnabled={handleToggleEnabled}
            onDelete={handleDelete}
          />
        ))}
        {programs.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            番組が見つかりません
          </p>
        )}
      </div>

      {/* デスクトップ: テーブル表示 */}
      <div className="hidden md:block">
        <ProgramsTable
          programs={programs}
          onToggleEnabled={handleToggleEnabled}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}

function ProgramCard({
  program,
  onToggleEnabled,
  onDelete,
}: {
  program: Program
  onToggleEnabled: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {program.name}
          </CardTitle>
          <Switch
            checked={program.enabled}
            onCheckedChange={(checked) => onToggleEnabled(program.id, checked)}
            aria-label={program.enabled ? '無効にする' : '有効にする'}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="secondary">
            {program.items.length} コンテンツ
          </Badge>
          <Badge variant={program.enabled ? 'default' : 'outline'}>
            {program.enabled ? '有効' : '無効'}
          </Badge>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          最終更新: {program.updatedAt}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/programs/${program.id}`}>
              <PencilIcon className="mr-2 size-4" />
              編集
            </Link>
          </Button>
          <DeleteButton id={program.id} onDelete={onDelete} />
        </div>
      </CardContent>
    </Card>
  )
}

function ProgramsTable({
  programs,
  onToggleEnabled,
  onDelete,
}: {
  programs: Program[]
  onToggleEnabled: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>番組名</TableHead>
            <TableHead className="w-[120px]">コンテンツ数</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px]">最終更新</TableHead>
            <TableHead className="w-[140px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.map((program) => (
            <TableRow key={program.id}>
              <TableCell className="font-medium">{program.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{program.items.length}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={program.enabled}
                    onCheckedChange={(checked) => onToggleEnabled(program.id, checked)}
                    aria-label={program.enabled ? '無効にする' : '有効にする'}
                  />
                  <span className="text-sm text-muted-foreground">
                    {program.enabled ? '有効' : '無効'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {program.updatedAt}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" asChild className="size-8">
                    <Link href={`/programs/${program.id}`}>
                      <PencilIcon className="size-4" />
                      <span className="sr-only">編集</span>
                    </Link>
                  </Button>
                  <DeleteButton id={program.id} onDelete={onDelete} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {programs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                番組が見つかりません
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
          <AlertDialogTitle>番組を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。番組とそれに関連するデータが完全に削除されます。
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
