import { getVertexAccessToken, buildVertexUrl } from './vertex-ai'
import { TTS_CONFIG } from '@/prompts/tts-config'

export interface TtsSpeaker {
  name: string
  voiceName: string
}

export interface SynthesisResult {
  wavBuffer: Buffer
  durationSeconds: number
}

const DEFAULT_SPEAKERS: [TtsSpeaker, TtsSpeaker] = [
  { name: 'SPEAKER_1', voiceName: TTS_CONFIG.voice },
  { name: 'SPEAKER_2', voiceName: TTS_CONFIG.voiceB },
]

export async function synthesize(
  scriptText: string,
  speakers: [TtsSpeaker, TtsSpeaker] = DEFAULT_SPEAKERS,
  modelOverride?: string
): Promise<SynthesisResult> {
  const chunks = splitIntoChunks(scriptText)
  const accessToken = await getVertexAccessToken()
  const audioBuffers = await Promise.all(
    chunks.map((chunk) => synthesizeChunk(chunk, speakers, accessToken, modelOverride))
  )
  const pcmBuffer = concatenateAudio(audioBuffers)
  const wavBuffer = pcmToWav(pcmBuffer, 24000)
  const durationSeconds = Math.round(pcmBuffer.length / (24000 * 1 * 2))
  return { wavBuffer, durationSeconds }
}

function splitIntoChunks(text: string): string[] {
  // Phase 2: 文境界で ~3500 バイト毎に分割する
  return [text]
}

async function synthesizeChunk(
  text: string,
  speakers: [TtsSpeaker, TtsSpeaker],
  accessToken: string,
  modelOverride?: string
): Promise<Buffer> {
  const model = modelOverride ?? process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-tts'
  const url = buildVertexUrl(model)

  const styledText = TTS_CONFIG.stylePrompt ? `${TTS_CONFIG.stylePrompt}\n\n${text}` : text

  const body = {
    contents: [{ role: 'user', parts: [{ text: styledText }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature: TTS_CONFIG.temperature,
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: speakers.map((s) => ({
            speaker: s.name,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voiceName } },
          })),
        },
      },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Vertex AI TTS エラー (${res.status}): ${detail}`)
  }

  const json = await res.json() as {
    candidates: Array<{
      content: { parts: Array<{ inlineData: { data: string } }> }
    }>
  }

  const base64 = json.candidates[0]?.content?.parts[0]?.inlineData?.data
  if (!base64) throw new Error('Vertex AI TTS レスポンスに音声データが含まれていません')

  return Buffer.from(base64, 'base64')
}

function concatenateAudio(buffers: Buffer[]): Buffer {
  // Phase 2: 複数チャンクのWAVヘッダを除去して連結する
  return buffers[0]
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = pcm.length
  const headerSize = 44

  const wav = Buffer.alloc(headerSize + dataSize)

  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(numChannels, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(byteRate, 28)
  wav.writeUInt16LE(blockAlign, 32)
  wav.writeUInt16LE(bitsPerSample, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  pcm.copy(wav, headerSize)

  return wav
}
