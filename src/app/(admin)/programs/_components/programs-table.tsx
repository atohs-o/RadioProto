'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Program } from '@/lib/schemas'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Pencil } from 'lucide-react'

interface ProgramsTableProps {
  programs: Program[]
}

export function ProgramsTable({ programs: initialPrograms }: ProgramsTableProps) {
  const [programs, setPrograms] = useState(initialPrograms)

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    // TODO: API呼び出しはClaude Codeが実装
    setPrograms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled } : p))
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>番組名</TableHead>
            <TableHead className="w-24 text-center">コンテンツ数</TableHead>
            <TableHead className="w-24 text-center">有効/無効</TableHead>
            <TableHead className="w-36">更新日</TableHead>
            <TableHead className="w-20 text-center sticky right-0 bg-card">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                番組がありません
              </TableCell>
            </TableRow>
          ) : (
            programs.map((program) => (
              <TableRow key={program.id}>
                <TableCell className="overflow-hidden font-medium">
                  <span className="truncate block">{program.name}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{program.items.length}件</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={program.enabled}
                    onCheckedChange={(checked) =>
                      handleToggleEnabled(program.id, checked)
                    }
                    aria-label={`${program.name}の有効/無効を切り替え`}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(program.updatedAt)}
                </TableCell>
                <TableCell className="text-center sticky right-0 bg-card">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/programs/${program.id}`}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">{program.name}を編集</span>
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
