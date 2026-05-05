'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Volume2, RefreshCw, Play } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { PageHeader } from '@/components/common/page-header'
import { AudioGenerationModal } from '@/components/admin/audio-generation-modal'
import type { Content } from '@/lib/types'
import { getContentById, generateScript, updateContent } from '@/lib/stubs'

const SCRIPT_BYTE_LIMIT = 4000

function getByteLength(str: string): number {
  return new Blob([str]).size
}

function getAudioStatusLabel(
  status: Content['audioStatus']
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (status) {
    case 'generated':
      return { label: '生成済み', variant: 'default' }
    case 'generating':
      return { label: '生成中', variant: 'secondary' }
    case 'pending':
      return { label: '未生成', variant: 'outline' }
    case 'error':
      return { label: 'エラー', variant: 'destructive' }
    default:
      return { label: '不明', variant: 'outline' }
  }
}

export default function ContentEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const isNew = id === 'new'

  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [audioModalOpen, setAudioModalOpen] = useState(false)

  // フォーム状態
  const [title, setTitle] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [scriptText, setScriptText] = useState('')
  const [tags, setTags] = useState('')
  const [audioStatus, setAudioStatus] = useState<Content['audioStatus']>('pending')

  useEffect(() => {
    if (isNew) {
      setLoading(false)
      return
    }

    getContentById(id).then((data) => {
      if (data) {
        setContent(data)
        setTitle(data.title)
        setSourceText(data.summary ?? '')
        setScriptText(data.scriptText ?? '')
        setTags(data.tags.join(', '))
        setAudioStatus(data.audioStatus)
      }
      setLoading(false)
    })
  }, [id, isNew])

  const handleGenerateScript = useCallback(async () => {
    if (!sourceText.trim()) return
    setGeneratingScript(true)
    try {
      const result = await generateScript(sourceText)
      setScriptText(result)
    } finally {
      setGeneratingScript(false)
    }
  }, [sourceText])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await updateContent(id, {
        title,
        summary: sourceText,
        scriptText,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      router.push('/contents')
    } finally {
      setSaving(false)
    }
  }, [id, title, sourceText, scriptText, tags, router])

  const handleAudioComplete = useCallback(() => {
    setAudioStatus('generated')
  }, [])

  const handleAudioCancel = useCallback(() => {
    // キャンセル処理
  }, [])

  const scriptByteLength = getByteLength(scriptText)
  const isOverLimit = scriptByteLength > SCRIPT_BYTE_LIMIT
  const statusInfo = getAudioStatusLabel(audioStatus)

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/contents">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title={isNew ? 'コンテンツ作成' : 'コンテンツ編集'}
          description={content?.title}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左カラム: コンテンツ編集 */}
        <Card>
          <CardHeader>
            <CardTitle>コンテンツ情報</CardTitle>
            <CardDescription>
              テキストを入力し、AIで台本を生成します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">タイトル</FieldLabel>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="コンテンツのタイトル"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="sourceText">元テキスト</FieldLabel>
                <Textarea
                  id="sourceText"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="台本の元になるテキストを入力..."
                  rows={6}
                />
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateScript}
                    disabled={generatingScript || !sourceText.trim()}
                  >
                    {generatingScript ? (
                      <Spinner className="mr-2 size-4" />
                    ) : (
                      <Sparkles className="mr-2 size-4" />
                    )}
                    AIで台本化
                  </Button>
                </div>
              </Field>

              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="scriptText">台本テキスト</FieldLabel>
                  <span
                    className={`text-xs ${
                      isOverLimit ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {scriptByteLength} / {SCRIPT_BYTE_LIMIT} バイト
                  </span>
                </div>
                <Textarea
                  id="scriptText"
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="台本テキスト（編集可能）"
                  rows={8}
                  className={isOverLimit ? 'border-destructive' : ''}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="tags">内容分類タグ</FieldLabel>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="タグをカンマ区切りで入力（例: 観光, イベント）"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" asChild>
                  <Link href="/contents">キャンセル</Link>
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || isOverLimit || !title.trim()}
                >
                  {saving && <Spinner className="mr-2 size-4" />}
                  保存
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* 右カラム: 音声セクション */}
        <Card>
          <CardHeader>
            <CardTitle>音声</CardTitle>
            <CardDescription>台本から音声を生成します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ステータス表示 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">ステータス:</span>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>

            {/* 音声プレビュー（生成済みの場合） */}
            {audioStatus === 'generated' && (
              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center gap-4">
                  <Button size="icon" variant="secondary">
                    <Play className="size-4" />
                  </Button>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-muted-foreground/20">
                      <div className="h-2 w-0 rounded-full bg-primary" />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>0:00</span>
                      <span>
                        {content?.audioDurationSec
                          ? `${Math.floor(content.audioDurationSec / 60)}:${String(
                              content.audioDurationSec % 60
                            ).padStart(2, '0')}`
                          : '0:00'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 音声生成ボタン */}
            <div className="flex gap-2">
              {audioStatus === 'generated' ? (
                <Button
                  variant="outline"
                  onClick={() => setAudioModalOpen(true)}
                  disabled={!scriptText.trim() || isOverLimit}
                >
                  <RefreshCw className="mr-2 size-4" />
                  音声を再生成
                </Button>
              ) : (
                <Button
                  onClick={() => setAudioModalOpen(true)}
                  disabled={
                    !scriptText.trim() ||
                    isOverLimit ||
                    audioStatus === 'generating'
                  }
                >
                  <Volume2 className="mr-2 size-4" />
                  音声を生成
                </Button>
              )}
            </div>

            {/* 注意事項 */}
            <p className="text-xs text-muted-foreground">
              音声生成には数十秒〜数分かかる場合があります。
              台本テキストは{SCRIPT_BYTE_LIMIT}
              バイト以内にしてください。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 音声生成モーダル */}
      <AudioGenerationModal
        open={audioModalOpen}
        onOpenChange={setAudioModalOpen}
        onComplete={handleAudioComplete}
        onCancel={handleAudioCancel}
      />
    </div>
  )
}
