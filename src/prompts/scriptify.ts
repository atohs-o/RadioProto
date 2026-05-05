import { SCRIPTIFY_CONFIG } from './scriptify-config'

export const SPEAKER_NAMES = { host: 'SPEAKER_1', guide: 'SPEAKER_2' } as const

export interface ScriptifyInput {
  sourceText: string
}

export function buildScriptifyPrompt(input: ScriptifyInput): string {
  return `${SCRIPTIFY_CONFIG.instruction}

【元情報】
${input.sourceText}

【台本】`
}
