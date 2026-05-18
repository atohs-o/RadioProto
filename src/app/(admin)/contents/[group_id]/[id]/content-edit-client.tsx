'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Volume2, RefreshCw, Check, CheckCircle2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { PageHeader } from '@/components/common/page-header'
import { AudioGenerationModal } from '@/components/admin/audio-generation-modal'
import type { Content, ScriptVersion, AudioFileInfo } from '@/lib/schemas/content'
import { createContentAction, updateContentAction, setActiveAudioAction } from '../../actions'

const SCRIPT_BYTE_LIMIT = 4000

const TTS_MODELS = [
  { value: 'gemini-2.5-flash-tts', label: 'Gemini 2.5 Flash（コスト優先）' },
  { value: 'gemini-2.5-pro-tts',   label: 'Gemini 2.5 Pro（クオリティ優先）' },
] as const

type TtsModelValue = typeof TTS_MODELS[number]['value']

function getByteLength(str: string): number {
  return new Blob([str]).size
}

function getAudioStatusLabel(
  status: Content['audioStatus']
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (status) {
    case 'generated':  return { label: '生成済み', variant: 'default' }
    case 'generating': return { label: '生成中',   variant: 'secondary' }
    case 'pending':    return { label: '未生成',   variant: 'outline' }
    case 'error':      return { label: 'エラー',   variant: 'destructive' }
    default:           return { label: '不明',     variant: 'outline' }
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  content: Content | null
  groupId: string
}

function SaveBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
      <CheckCircle2 className="size-4 shrink-0" />
      {message}
    </div>
  )
}

export function ContentEditClient({ content, groupId }: Props) {
  const router = useRouter()
  const isNew = content === null

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [isPendingAudio, setIsPendingAudio] = useState(false)
  const [ttsModel, setTtsModel] = useState<TtsModelValue>('gemini-2.5-flash-tts')

  const [title, setTitle] = useState(content?.title ?? '')
  const [sourceText, setSourceText] = useState(content?.sourceText ?? content?.summary ?? '')
  const [scriptText, setScriptText] = useState(content?.scriptText ?? '')
  const [tags, setTags] = useState(content?.tags.join(', ') ?? '')
  const [audioStatus, setAudioStatus] = useState<Content['audioStatus']>(
    content?.audioStatus ?? 'pending'
  )
  const [scriptVersions, setScriptVersions] = useState<ScriptVersion[]>(
    content?.scriptVersions ?? []
  )
  const [allAudioFiles, setAllAudioFiles] = useState<AudioFileInfo[]>(
    content?.allAudioFiles ?? []
  )
  const [activeAudioFileId, setActiveAudioFileId] = useState<string | undefined>(
    content?.activeAudioFileId
  )

  // 新規は最初から dirty、既存は変更があったときのみ dirty
  const [isContentDirty, setIsContentDirty] = useState(isNew)
  const [isAudioDirty, setIsAudioDirty] = useState(false)
  const [savingAudio, setSavingAudio] = useState(false)
  const [audioSaveError, setAudioSaveError] = useState<string | null>(null)

  const [contentBanner, setContentBanner] = useState<string | null>(null)
  const [audioBanner, setAudioBanner] = useState<string | null>(null)
  const contentBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (contentBannerTimer.current) clearTimeout(contentBannerTimer.current)
      if (audioBannerTimer.current) clearTimeout(audioBannerTimer.current)
    }
  }, [])

  const showContentBanner = (msg: string) => {
    if (contentBannerTimer.current) clearTimeout(contentBannerTimer.current)
    setContentBanner(msg)
    contentBannerTimer.current = setTimeout(() => setContentBanner(null), 3000)
  }

  const showAudioBanner = (msg: string) => {
    if (audioBannerTimer.current) clearTimeout(audioBannerTimer.current)
    setAudioBanner(msg)
    audioBannerTimer.current = setTimeout(() => setAudioBanner(null), 3000)
  }

  const handleGenerateScript = useCallback(async () => {
    if (!sourceText.trim()) return
    setGeneratingScript(true)
    setScriptError(null)
    try {
      const res = await fetch('/api/admin/scriptify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText, contentId: content?.id, title }),
      })
      const data = await res.json() as {
        scriptText?: string
        version?: { id: string; model: string; createdAt: string }
        error?: string
      }
      if (!res.ok || !data.scriptText) {
        setScriptError(data.error ?? '台本生成に失敗しました')
        return
      }
      setScriptText(data.scriptText)
      setIsContentDirty(true)
      if (data.version) {
        const newVersion: ScriptVersion = {
          id: data.version.id,
          text: data.scriptText,
          model: data.version.model,
          createdAt: data.version.createdAt,
        }
        setScriptVersions((prev) => [newVersion, ...prev].slice(0, 3))
      }
    } catch {
      setScriptError('台本生成中にエラーが発生しました')
    } finally {
      setGeneratingScript(false)
    }
  }, [sourceText, content, title])

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
      const result = await createContentAction(formData, groupId)
      if ('error' in result && result.error) {
        setSaveError(result.error)
        setSaving(false)
        return
      }
      if ('id' in result && result.id) {
        router.push(`/contents/${groupId}/${result.id}`)
        return
      }
    } else {
      const result = await updateContentAction(content.id, formData)
      if (result.error) {
        setSaveError(result.error)
        setSaving(false)
        return
      }
      setIsContentDirty(false)
      showContentBanner('コンテンツ情報を保存しました')
    }
    setSaving(false)
  }, [isNew, content, title, sourceText, scriptText, tags, router, groupId])

  const handleAudioComplete = useCallback((audioFile: AudioFileInfo) => {
    // TTS API が active_audio_file_id を DB に書き込み済みのため dirty にしない
    setAudioStatus('generated')
    setAllAudioFiles((prev) => [audioFile, ...prev].slice(0, 3))
    setActiveAudioFileId(audioFile.id)
    setIsPendingAudio(false)
    router.refresh()
  }, [router])

  const handleSelectActiveAudio = useCallback((audioFile: AudioFileInfo) => {
    setActiveAudioFileId(audioFile.id)
    setIsAudioDirty(true)
  }, [])

  const handleSaveAudio = useCallback(async () => {
    if (!content?.id || !activeAudioFileId) return
    setSavingAudio(true)
    setAudioSaveError(null)
    const result = await setActiveAudioAction(content.id, activeAudioFileId)
    if (result.error) {
      setAudioSaveError(result.error)
      setSavingAudio(false)
      return
    }
    setIsAudioDirty(false)
    setSavingAudio(false)
    showAudioBanner('音声設定を保存しました')
  }, [content, activeAudioFileId])

  const scriptByteLength = getByteLength(scriptText)
  const isOverLimit = scriptByteLength > SCRIPT_BYTE_LIMIT
  const statusInfo = getAudioStatusLabel(audioStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/contents/${groupId}`}>
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
        {/* 左カラム: テキスト */}
        <Card>
          <CardHeader>
            <CardTitle>コンテンツ情報</CardTitle>
            <CardDescription>テキストを入力し、AIで台本を生成します</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">タイトル</FieldLabel>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setIsContentDirty(true) }}
                  placeholder="コンテンツのタイトル"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="sourceText">元テキスト</FieldLabel>
                <Textarea
                  id="sourceText"
                  value={sourceText}
                  onChange={(e) => { setSourceText(e.target.value); setIsContentDirty(true) }}
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
                  <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {scriptByteLength} / {SCRIPT_BYTE_LIMIT} バイト
                  </span>
                </div>
                <Textarea
                  id="scriptText"
                  value={scriptText}
                  onChange={(e) => { setScriptText(e.target.value); setIsContentDirty(true) }}
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

              {scriptVersions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    台本生成履歴（{scriptVersions.length}件）
                  </p>
                  <div className="space-y-1">
                    {scriptVersions.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono">{v.model}</span>
                          <span className="ml-2">{formatDate(v.createdAt)}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => { setScriptText(v.text); setIsContentDirty(true) }}
                        >
                          適用
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Field>
                <FieldLabel htmlFor="tags">内容分類タグ</FieldLabel>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => { setTags(e.target.value); setIsContentDirty(true) }}
                  placeholder="タグをカンマ区切りで入力（例: 観光, イベント）"
                />
              </Field>

              {contentBanner && <SaveBanner message={contentBanner} />}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" asChild>
                  <Link href={`/contents/${groupId}`}>キャンセル</Link>
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || isOverLimit || !title.trim() || !isContentDirty}
                >
                  {saving && <Spinner className="mr-2 size-4" />}
                  保存
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* 右カラム: 音声 */}
        <Card>
          <CardHeader>
            <CardTitle>音声</CardTitle>
            <CardDescription>台本から音声を生成します（SPEAKER_1 / SPEAKER_2）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">ステータス:</span>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>

            <div className="space-y-2">
              {isNew ? (
                <p className="text-sm text-muted-foreground">保存後に音声を生成できます。</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={ttsModel}
                      onValueChange={(v) => setTtsModel(v as TtsModelValue)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TTS_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={() => { setIsPendingAudio(true); setAudioModalOpen(true) }}
                      variant={audioStatus === 'generated' ? 'outline' : 'default'}
                      disabled={!scriptText.trim() || isOverLimit || audioStatus === 'generating' || isPendingAudio}
                    >
                      {audioStatus === 'generated' ? (
                        <RefreshCw className="mr-2 size-4" />
                      ) : (
                        <Volume2 className="mr-2 size-4" />
                      )}
                      {audioStatus === 'generated' ? '音声を再生成' : '音声を生成'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    台本テキストは{SCRIPT_BYTE_LIMIT}バイト以内にしてください。数十秒かかります。
                  </p>
                </>
              )}
            </div>

            {(allAudioFiles.length > 0 || isPendingAudio) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  生成済み音声（{allAudioFiles.length}件）
                </p>
                <div className="space-y-3">
                  {isPendingAudio && (
                    <div className="flex items-center gap-3 rounded-lg border p-3 text-sm text-muted-foreground">
                      <Spinner className="size-4 animate-spin" />
                      <span>音声を生成中...</span>
                    </div>
                  )}
                  {allAudioFiles.map((af) => {
                    const isActive = af.id === activeAudioFileId
                    return (
                      <div
                        key={af.id}
                        className={`rounded-lg border p-3 ${isActive ? 'border-primary bg-primary/5' : ''}`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{af.ttsModel}</span>
                            <span className="ml-2">{formatDate(af.createdAt)}</span>
                          </div>
                          {isActive ? (
                            <Badge variant="default" className="text-xs gap-1">
                              <Check className="size-3" />
                              使用中
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleSelectActiveAudio(af)}
                            >
                              使用する
                            </Button>
                          )}
                        </div>
                        <audio controls className="w-full" src={af.url}>
                          <track kind="captions" />
                        </audio>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!isNew && (
              <div className="space-y-2 pt-2">
                {audioSaveError && (
                  <p className="text-sm text-destructive">{audioSaveError}</p>
                )}
                {audioBanner && <SaveBanner message={audioBanner} />}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveAudio}
                    disabled={savingAudio || !isAudioDirty || !activeAudioFileId}
                  >
                    {savingAudio && <Spinner className="mr-2 size-4" />}
                    音声設定を保存
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!isNew && (
        <AudioGenerationModal
          open={audioModalOpen}
          onOpenChange={setAudioModalOpen}
          contentId={content.id}
          scriptText={scriptText}
          ttsModel={ttsModel}
          onComplete={handleAudioComplete}
          onCancel={() => { setIsPendingAudio(false); setAudioModalOpen(false) }}
        />
      )}
    </div>
  )
}
