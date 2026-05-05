'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SparklesIcon, Volume2Icon, Loader2Icon, SaveIcon } from 'lucide-react'
import type { Content } from '@/lib/schemas/content'
import {
  createContent,
  updateContent,
  generateScript,
  generateAudio,
} from '@/lib/api/contents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ContentEditFormProps {
  content: Content | null
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

const MAX_SCRIPT_BYTES = 4000

export function ContentEditForm({ content }: ContentEditFormProps) {
  const router = useRouter()
  const isNew = content === null

  const [title, setTitle] = useState(content?.title ?? '')
  const [sourceType, setSourceType] = useState<Content['sourceType']>(
    content?.sourceType ?? 'manual'
  )
  const [sourceText, setSourceText] = useState(content?.sourceText ?? '')
  const [scriptText, setScriptText] = useState(content?.scriptText ?? '')
  const [tags, setTags] = useState(content?.tags.join(', ') ?? '')
  const [audioStatus, setAudioStatus] = useState<Content['audioStatus']>(
    content?.audioStatus ?? 'pending'
  )
  const [audioUrl, setAudioUrl] = useState(content?.audioUrl ?? '')
  const [audioDurationSec, setAudioDurationSec] = useState(
    content?.audioDurationSec ?? 0
  )

  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const scriptByteLength = useMemo(() => {
    return new TextEncoder().encode(scriptText).length
  }, [scriptText])

  const isScriptOverLimit = scriptByteLength > MAX_SCRIPT_BYTES

  const handleGenerateScript = useCallback(async () => {
    if (!sourceText.trim()) return
    setIsGeneratingScript(true)
    try {
      const generatedScript = await generateScript(sourceText)
      setScriptText(generatedScript)
    } finally {
      setIsGeneratingScript(false)
    }
  }, [sourceText])

  const handleGenerateAudio = useCallback(async () => {
    if (!scriptText.trim() || isScriptOverLimit) return
    setIsGeneratingAudio(true)
    setAudioStatus('generating')
    try {
      const result = await generateAudio(scriptText)
      setAudioUrl(result.audioUrl)
      setAudioDurationSec(result.audioDurationSec)
      setAudioStatus('generated')
    } catch {
      setAudioStatus('error')
    } finally {
      setIsGeneratingAudio(false)
    }
  }, [scriptText, isScriptOverLimit])

  const handleSave = useCallback(async () => {
    if (!title.trim()) return
    setIsSaving(true)
    try {
      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const data = {
        title,
        sourceType,
        sourceText,
        scriptText,
        tags: tagArray,
        audioStatus,
        audioUrl: audioUrl || undefined,
        audioDurationSec: audioDurationSec || undefined,
        radioRegistered: content?.radioRegistered ?? false,
      }

      if (isNew) {
        await createContent(data)
      } else {
        await updateContent(content.id, data)
      }
      router.push('/contents')
    } finally {
      setIsSaving(false)
    }
  }, [
    title,
    sourceType,
    sourceText,
    scriptText,
    tags,
    audioStatus,
    audioUrl,
    audioDurationSec,
    isNew,
    content,
    router,
  ])

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">タイトル</FieldLabel>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="コンテンツのタイトルを入力"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="sourceType">ソース種別</FieldLabel>
              <Select
                value={sourceType}
                onValueChange={(value: Content['sourceType']) =>
                  setSourceType(value)
                }
              >
                <SelectTrigger id="sourceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="polling">ポーリング</SelectItem>
                  <SelectItem value="manual">手動入力</SelectItem>
                  <SelectItem value="url">URL取得</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="tags">タグ（カンマ区切り）</FieldLabel>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="観光, イベント, グルメ"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>テキスト</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sourceText">元テキスト</FieldLabel>
              <Textarea
                id="sourceText"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="ポーリング結果または手入力のテキストを入力..."
                rows={6}
              />
            </Field>

            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={handleGenerateScript}
                disabled={!sourceText.trim() || isGeneratingScript}
              >
                {isGeneratingScript ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SparklesIcon className="mr-2 h-4 w-4" />
                )}
                AIで台本化
              </Button>
            </div>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="scriptText">台本テキスト</FieldLabel>
                <span
                  className={`text-sm ${
                    isScriptOverLimit
                      ? 'text-destructive font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  {scriptByteLength.toLocaleString()} / {MAX_SCRIPT_BYTES.toLocaleString()} バイト
                </span>
              </div>
              <Textarea
                id="scriptText"
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="音声生成用の台本テキストを入力または生成..."
                rows={8}
                className={isScriptOverLimit ? 'border-destructive' : ''}
              />
              {isScriptOverLimit && (
                <p className="text-sm text-destructive">
                  台本テキストが上限を超えています。{MAX_SCRIPT_BYTES}バイト以下に編集してください。
                </p>
              )}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>音声</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">ステータス:</span>
              <Badge variant={AUDIO_STATUS_VARIANTS[audioStatus]}>
                {AUDIO_STATUS_LABELS[audioStatus]}
              </Badge>
              {audioDurationSec > 0 && (
                <span className="text-sm text-muted-foreground">
                  （{Math.floor(audioDurationSec / 60)}分{audioDurationSec % 60}秒）
                </span>
              )}
            </div>

            {audioStatus === 'generated' && audioUrl && (
              <div className="flex flex-col gap-2">
                <audio controls className="w-full" src={audioUrl}>
                  <track kind="captions" />
                </audio>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleGenerateAudio}
                disabled={
                  !scriptText.trim() || isScriptOverLimit || isGeneratingAudio
                }
              >
                {isGeneratingAudio ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Volume2Icon className="mr-2 h-4 w-4" />
                )}
                {audioStatus === 'generated' ? '音声を再生成' : '音声を生成'}
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.push('/contents')}>
          キャンセル
        </Button>
        <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
          {isSaving ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <SaveIcon className="mr-2 h-4 w-4" />
          )}
          保存
        </Button>
      </div>
    </div>
  )
}
