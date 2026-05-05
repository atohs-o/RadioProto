import type { Content } from '@/lib/schemas/content'
import { MOCK_CONTENTS } from '@/lib/mocks/contents'

/**
 * コンテンツ一覧を取得
 * TODO: API接続はClaude Codeが実装
 */
export async function getContents(): Promise<Content[]> {
  await new Promise((r) => setTimeout(r, 200))
  return MOCK_CONTENTS
}

/**
 * コンテンツを1件取得
 * TODO: API接続はClaude Codeが実装
 */
export async function getContent(id: string): Promise<Content | null> {
  await new Promise((r) => setTimeout(r, 200))
  return MOCK_CONTENTS.find((c) => c.id === id) ?? null
}

/**
 * コンテンツを作成
 * TODO: API接続はClaude Codeが実装
 */
export async function createContent(
  data: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Content> {
  await new Promise((r) => setTimeout(r, 200))
  console.log('[createContent] 作成データ:', data)
  const newContent: Content = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return newContent
}

/**
 * コンテンツを更新
 * TODO: API接続はClaude Codeが実装
 */
export async function updateContent(
  id: string,
  data: Partial<Content>
): Promise<Content | null> {
  await new Promise((r) => setTimeout(r, 200))
  console.log('[updateContent] ID:', id, '更新データ:', data)
  const existing = MOCK_CONTENTS.find((c) => c.id === id)
  if (!existing) return null
  return {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * コンテンツを削除
 * TODO: API接続はClaude Codeが実装
 */
export async function deleteContent(id: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 200))
  console.log('[deleteContent] ID:', id)
  return true
}

/**
 * AIで台本を生成
 * TODO: Gemini API呼び出しをClaude Codeが実装
 */
export async function generateScript(sourceText: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1500))
  console.log('[generateScript] 元テキスト:', sourceText)
  return `【生成された台本】\n\n皆さん、こんにちは。\n\n${sourceText}\n\nぜひお立ち寄りください。ありがとうございました。`
}

/**
 * 音声を生成
 * TODO: Vertex AI TTS呼び出しをClaude Codeが実装
 */
export async function generateAudio(
  scriptText: string
): Promise<{ audioUrl: string; audioDurationSec: number }> {
  await new Promise((r) => setTimeout(r, 2000))
  console.log('[generateAudio] 台本テキスト:', scriptText)
  return {
    audioUrl: '/mock-audio.mp3',
    audioDurationSec: Math.floor(scriptText.length / 5),
  }
}
