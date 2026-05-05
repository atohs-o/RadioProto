'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Volume2, RefreshCw } from 'lucide-react'
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
import type { Content } from '@/lib/schemas/content'
import { createContentAction, updateContentAction } from '../actions'

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

interface Props {
  content: Content | null
}

export function ContentEditClient({ content }: Props) {
  const router = useRouter()
  const isNew = content === null

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [audioModalOpen, setAudioModalOpen] = useState(false)

  const [title, setTitle] = useState(content?.title ?? '')
  const [sourceText, setSourceText] = useState(content?.sourceText ?? content?.summary ?? '')
  const [scriptText, setScriptText] = useState(content?.scriptText ?? '')
  const [tags, setTags] = useState(content?.tags.join(', ') ?? '')
  const [audioStatus, setAudioStatus] = useState<Content['audioStatus']>(
    content?.audioStatus ?? 'pending'
  )
  const [audioUrl, setAudioUrl] = useState<string | undefined>(content?.audioUrl)
  const [audioDurationSec, setAudioDurationSec] = useState<number | undefined>(
    content?.audioDurationSec
  )

  const handleGenerateScript = useCallback(async () => {
    if (!sourceText.trim()) return
    setGeneratingScript(true)
    setScriptError(null)
    try {
      const res = await fetch('/api/admin/scriptify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText }),
      })
      const data = await res.json() as { scriptText?: string; error?: string }
      if (!res.ok || !data.scriptText) {
        setScriptError(data.error ?? '台本生成に失敗しました')
        return
      }
      setScriptText(data.scriptText)
    } catch {
      setScriptError('台本生成中にエラーが発生しました')
    } finally {
      setGeneratingScript(false)
    }
  }, [sourceText])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)

    const formData = {
      title,
      source_type: content?.sourceType ?? 'manual',
      source_text: sourceText,
      script_text: scriptText,
      tags_csv: tags,
    } as const

    if (isNew) {
      const result = await createContentAction(formData)
      if ('error' in result && result.error) {
        setSaveError(result.error)
        setSaving(false)
        return
      }
      if ('id' in result && result.id) {
        router.push(`/contents/${result.id}`)
        return
      }
    } else {
      const result = await updateContentAction(content.id, formData)
      if (result.error) {
        setSaveError(result.error)
        setSaving(false)
        return
      }
      router.push('/contents')
    }
  }, [isNew, content, title, sourceText, scriptText, tags, router])

  const handleAudioComplete = useCallback((url: string, duration: number) => {
    setAudioStatus('generated')
    setAudioUrl(url)
    setAudioDurationSec(duration)
  }, [])

  const scriptByteLength = getByteLength(scriptText)
  const isOverLimit = scriptByteLength > SCRIPT_BYTE_LIMIT
  const statusInfo = getAudioStatusLabel(audioStatus)

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

      {saveError && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
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
                {scriptError && (
                  <p className="text-sm text-destructive">{scriptError}</p>
                )}
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
                {isOverLimit && (
                  <p className="text-sm text-destructive">
                    台本テキストが上限を超えています。{SCRIPT_BYTE_LIMIT}バイト以下に編集してください。
                  </p>
                )}
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

        <Card>
          <CardHeader>
            <CardTitle>音声</CardTitle>
            <CardDescription>台本から音声を生成します（Host/Guide 2名）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">ステータス:</span>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>

            {audioStatus === 'generated' && audioUrl && (
              <div className="rounded-lg bg-muted p-4">
                <audio controls className="w-full" src={audioUrl}>
                  <track kind="captions" />
                </audio>
                {audioDurationSec !== undefined && audioDurationSec > 0 && (
                  <p className="mt-2 text-right text-xs text-muted-foreground">
                    {Math.floor(audioDurationSec / 60)}分{audioDurationSec % 60}秒
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {isNew ? (
                <p className="text-sm text-muted-foreground">
                  保存後に音声を生成できます。
                </p>
              ) : audioStatus === 'generated' ? (
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

            <p className="text-xs text-muted-foreground">
              音声生成には数十秒〜数分かかる場合があります。
              台本テキストは{SCRIPT_BYTE_LIMIT}バイト以内にしてください。
            </p>
          </CardContent>
        </Card>
      </div>

      {!isNew && (
        <AudioGenerationModal
          open={audioModalOpen}
          onOpenChange={setAudioModalOpen}
          contentId={content.id}
          scriptText={scriptText}
          onComplete={handleAudioComplete}
          onCancel={() => setAudioModalOpen(false)}
        />
      )}
    </div>
  )
}
