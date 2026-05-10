import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ContentMetadataSchema,
  ContentFormSchema,
  AudioFileInfoSchema,
  type Content,
  type ContentForm,
  type AudioFileInfo,
} from '@/lib/schemas/content'
import type { Database, Json } from '@/types/database.types'

type ContentRow = Database['public']['Tables']['contents']['Row']
type AudioFileRow = Database['public']['Tables']['audio_files']['Row']

function toContent(
  row: ContentRow,
  audioFile?: AudioFileRow | null,
  signedAudioUrl?: string
): Content {
  const meta = ContentMetadataSchema.parse(row.metadata ?? {})
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? undefined,
    sourceType: row.source_type as Content['sourceType'],
    tags: meta.tags,
    audioStatus: meta.audio_status,
    radioRegistered: meta.radio_registered,
    sourceText: meta.source_text,
    scriptText: row.script,
    audioUrl: signedAudioUrl ?? undefined,
    audioDurationSec: audioFile?.duration_seconds ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getContents(): Promise<Content[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contents')
    .select('*, audio_files(id, storage_path, duration_seconds)')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const audioFiles = Array.isArray(row.audio_files) ? row.audio_files : []
    const meta = ContentMetadataSchema.parse(row.metadata ?? {})
    const activeId = meta.active_audio_file_id
    const activeAudio = (activeId ? audioFiles.find((f: { id: string }) => f.id === activeId) : null)
      ?? audioFiles[0]
      ?? null
    return toContent(row as unknown as ContentRow, activeAudio as AudioFileRow | null)
  })
}

export async function getContentById(id: string): Promise<Content | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const adminClient = createAdminClient()

  // 最新3件の音声ファイルを取得
  const { data: audioRows } = await adminClient
    .from('audio_files')
    .select('id, storage_path, duration_seconds, tts_model, created_at')
    .eq('content_id', id)
    .order('created_at', { ascending: false })
    .limit(3)

  // 各音声ファイルの署名付きURLを生成
  const allAudioFiles: AudioFileInfo[] = await Promise.all(
    (audioRows ?? []).map(async (af) => {
      const { data: sd } = await adminClient.storage
        .from('audio-files')
        .createSignedUrl(af.storage_path, 3600)
      return AudioFileInfoSchema.parse({
        id: af.id,
        url: sd?.signedUrl ?? '',
        durationSeconds: af.duration_seconds ?? undefined,
        ttsModel: af.tts_model ?? '',
        createdAt: af.created_at,
      })
    })
  )

  const meta = ContentMetadataSchema.parse(data.metadata ?? {})
  const activeId = meta.active_audio_file_id
  const activeAudio = allAudioFiles.find((f) => f.id === activeId) ?? allAudioFiles[0]

  const base = toContent(data as unknown as ContentRow, null, activeAudio?.url)
  return {
    ...base,
    audioDurationSec: activeAudio?.durationSeconds,
    allAudioFiles,
    activeAudioFileId: activeAudio?.id,
    scriptVersions: meta.script_versions,
  }
}

export async function createContent(form: ContentForm): Promise<Content> {
  const validated = ContentFormSchema.parse(form)
  const supabase = await createClient()

  const metadata: Json = {
    source_text: validated.source_text ?? '',
    audio_status: 'pending',
    radio_registered: false,
    tags: validated.tags_csv
      ? validated.tags_csv.split(',').map((t) => t.trim()).filter(Boolean)
      : [],
  }

  const { data, error } = await supabase
    .from('contents')
    .insert({
      title: validated.title,
      script: validated.script_text ?? '',
      source_type: validated.source_type,
      summary: validated.source_text ?? null,
      metadata,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toContent(data)
}

export async function updateContent(
  id: string,
  form: Partial<ContentForm>
): Promise<Content | null> {
  const supabase = await createClient()

  const { data: currentRow } = await supabase
    .from('contents')
    .select('metadata')
    .eq('id', id)
    .single()
  if (!currentRow) return null

  const meta = ContentMetadataSchema.parse(currentRow.metadata ?? {})
  const newTags =
    form.tags_csv !== undefined
      ? form.tags_csv.split(',').map((t) => t.trim()).filter(Boolean)
      : meta.tags

  const newMeta = {
    source_text: form.source_text !== undefined ? form.source_text : (meta.source_text ?? ''),
    audio_status: meta.audio_status,
    radio_registered: meta.radio_registered,
    tags: newTags,
    script_versions: meta.script_versions,
    active_audio_file_id: meta.active_audio_file_id,
  }

  const updatePayload: Database['public']['Tables']['contents']['Update'] = {
    updated_at: new Date().toISOString(),
    metadata: newMeta as Json,
  }

  if (form.title !== undefined) updatePayload.title = form.title
  if (form.script_text !== undefined) updatePayload.script = form.script_text
  if (form.source_type !== undefined) updatePayload.source_type = form.source_type
  if (form.source_text !== undefined) updatePayload.summary = form.source_text

  const { data, error } = await supabase
    .from('contents')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toContent(data as unknown as ContentRow)
}

export async function deleteContent(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('contents').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

