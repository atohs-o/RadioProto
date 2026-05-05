import type { Program } from '@/lib/schemas'
import { MOCK_PROGRAMS } from '@/lib/mocks/programs'

/**
 * 番組一覧を取得
 * TODO: API接続はClaude Codeが実装
 */
export async function getPrograms(): Promise<Program[]> {
  return MOCK_PROGRAMS
}

/**
 * 番組詳細を取得
 * TODO: API接続はClaude Codeが実装
 */
export async function getProgram(id: string): Promise<Program | null> {
  const program = MOCK_PROGRAMS.find((p) => p.id === id)
  return program ?? null
}

/**
 * 番組を更新
 * TODO: API接続はClaude Codeが実装
 */
export async function updateProgram(
  id: string,
  data: Partial<Program>
): Promise<Program | null> {
  const program = MOCK_PROGRAMS.find((p) => p.id === id)
  if (!program) return null
  return { ...program, ...data, updatedAt: new Date().toISOString() }
}

/**
 * 路線データCSVをインポート（スタブ）
 * TODO: CSV解析はClaude Codeが実装
 */
export async function importRouteCSV(
  _programId: string,
  _file: File
): Promise<{ lat: number; lng: number }[]> {
  // スタブ: 固定の路線ポイントを返す
  return [
    { lat: 36.3006, lng: 137.8729 },
    { lat: 36.3100, lng: 137.8800 },
    { lat: 36.3234, lng: 137.8821 },
  ]
}
