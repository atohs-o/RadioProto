import { z } from 'zod'

export const ScriptVersionSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  model: z.string(),
  createdAt: z.string(),
})
export type ScriptVersion = z.infer<typeof ScriptVersionSchema>

export const AudioFileInfoSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  durationSeconds: z.number().optional(),
  ttsModel: z.string(),
  createdAt: z.string(),
})
export type AudioFileInfo = z.infer<typeof AudioFileInfoSchema>

export const contentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string().optional(),
  sourceType: z.enum(['polling', 'manual', 'url']),
  tags: z.array(z.string()),
  audioStatus: z.enum(['pending', 'generating', 'generated', 'error']),
  radioRegistered: z.boolean(),
  sourceText: z.string().optional(),
  scriptText: z.string().optional(),
  audioUrl: z.string().optional(),
  audioDurationSec: z.number().optional(),
  scriptVersions: z.array(ScriptVersionSchema).optional(),
  allAudioFiles: z.array(AudioFileInfoSchema).optional(),
  activeAudioFileId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Content = z.infer<typeof contentSchema>

export const ContentMetadataSchema = z.object({
  source_text: z.string().optional(),
  audio_status: z.enum(['pending', 'generating', 'generated', 'error']).default('pending'),
  radio_registered: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  script_versions: z.array(ScriptVersionSchema).default([]),
  active_audio_file_id: z.string().optional(),
})

export type ContentMetadata = z.infer<typeof ContentMetadataSchema>

export const ContentFormSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください').max(200),
  source_type: z.enum(['polling', 'manual', 'url']),
  source_text: z.string().optional(),
  script_text: z.string().optional(),
  tags_csv: z.string().optional(),
})

export type ContentForm = z.infer<typeof ContentFormSchema>
