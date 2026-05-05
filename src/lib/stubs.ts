import type { Content, Program, PollingSite } from './types'
import type { Bus, Trip, PlayEvent, UserProfile } from '@/types'

// ============================================
// モックデータ
// ============================================

export const MOCK_CONTENTS: Content[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: '安曇野わさび農場 秋の収穫祭',
    summary: '10月15日〜17日に開催。入場無料、わさびソフト販売あり。',
    sourceText: '大王わさび農場では毎年恒例の秋の収穫祭を開催します。期間中は入場無料で、新鮮なわさびを使った各種グルメをお楽しみいただけます。',
    sourceType: 'polling',
    tags: ['観光', 'イベント'],
    audioStatus: 'generated',
    radioRegistered: true,
    scriptText: 'みなさん、こんにちは。大王わさび農場からのお知らせです。10月15日から17日まで、秋の収穫祭を開催いたします。入場は無料です。新鮮なわさびソフトもぜひお試しください。',
    audioUrl: '/mock-audio.mp3',
    audioDurationSec: 95,
    createdAt: '2026-05-01T09:00:00Z',
    updatedAt: '2026-05-01T10:30:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    title: '穂高神社 例大祭のお知らせ',
    summary: '9月26日〜27日。交通規制あり、穂高駅周辺は迂回推奨。',
    sourceText: '穂高神社の例大祭が9月26日、27日に執り行われます。期間中は周辺道路で交通規制が実施されますので、穂高駅周辺へお越しの方は迂回をお願いいたします。',
    sourceType: 'manual',
    tags: ['観光', '祭り'],
    audioStatus: 'pending',
    radioRegistered: false,
    createdAt: '2026-05-02T11:00:00Z',
    updatedAt: '2026-05-02T11:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    title: '道の駅アルプス安曇野ほりがねの里 新商品情報',
    summary: '地元産りんごを使った新作スイーツが登場。',
    sourceText: '道の駅アルプス安曇野ほりがねの里では、地元堀金産のりんごを使用した新作アップルパイを販売開始しました。',
    sourceType: 'url',
    tags: ['グルメ', '道の駅'],
    audioStatus: 'generating',
    radioRegistered: false,
    createdAt: '2026-05-03T08:00:00Z',
    updatedAt: '2026-05-03T09:15:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    title: '北アルプス登山口 秋の紅葉情報',
    summary: '中房温泉登山口付近が見頃。10月中旬まで楽しめます。',
    sourceText: '北アルプスの秋の紅葉シーズンが始まりました。中房温泉登山口付近は現在見頃を迎えており、10月中旬まで美しい紅葉をお楽しみいただけます。',
    sourceType: 'polling',
    tags: ['自然', '登山'],
    audioStatus: 'error',
    radioRegistered: false,
    createdAt: '2026-05-04T14:00:00Z',
    updatedAt: '2026-05-04T14:30:00Z',
  },
]

export const MOCK_PROGRAMS: Program[] = [
  {
    id: '660e8400-e29b-41d4-a716-446655440001',
    name: '安曇野北部ルート',
    enabled: true,
    routePoints: [
      { lat: 36.3006, lng: 137.8729 }, // 穂高駅
      { lat: 36.3100, lng: 137.8800 },
      { lat: 36.3234, lng: 137.8821 }, // 大王わさび農場
    ],
    items: [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        position: { lat: 36.3006, lng: 137.8729 },
        locationName: '穂高駅前',
        contentId: '550e8400-e29b-41d4-a716-446655440001',
        contentTitle: '安曇野わさび農場 秋の収穫祭',
        audioDurationSec: 95,
      },
    ],
    updatedAt: '2026-05-01T12:00:00Z',
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440002',
    name: '安曇野南部ルート',
    enabled: false,
    routePoints: [
      { lat: 36.2500, lng: 137.8500 },
      { lat: 36.2600, lng: 137.8600 },
    ],
    items: [],
    updatedAt: '2026-05-02T15:00:00Z',
  },
]

export const MOCK_POLLING_SITES: PollingSite[] = [
  {
    id: '880e8400-e29b-41d4-a716-446655440001',
    name: '安曇野市公式サイト',
    url: 'https://www.city.azumino.nagano.jp/',
    enabled: true,
    lastFetchedAt: '2026-05-05T08:00:00Z',
    lastStatus: 'success',
  },
  {
    id: '880e8400-e29b-41d4-a716-446655440002',
    name: '信州観光ナビ',
    url: 'https://www.nagano-tabi.net/',
    enabled: true,
    lastFetchedAt: '2026-05-05T08:00:00Z',
    lastStatus: 'error',
  },
  {
    id: '880e8400-e29b-41d4-a716-446655440003',
    name: '大王わさび農場',
    url: 'https://www.daiowasabi.co.jp/',
    enabled: false,
    lastStatus: 'pending',
  },
]

// ============================================
// スタブ関数（TODO: Claude Codeが実装）
// ============================================

// コンテンツ関連
export async function getContents(): Promise<Content[]> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_CONTENTS
}

export async function getContentById(id: string): Promise<Content | null> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_CONTENTS.find(c => c.id === id) ?? null
}

export async function saveContent(content: Content): Promise<Content> {
  // TODO: API接続はClaude Codeが実装
  return content
}

export async function deleteContent(id: string): Promise<void> {
  // TODO: API接続はClaude Codeが実装
  console.log('Delete content:', id)
}

export async function generateScript(text: string): Promise<string> {
  // TODO: Gemini API呼び出しをClaude Codeが実装
  await new Promise(resolve => setTimeout(resolve, 1500))
  return `【生成された台本】\n\nみなさん、こんにちは。本日は${text.slice(0, 20)}についてお伝えします。\n\n${text}\n\nご清聴ありがとうございました。`
}

export async function generateAudio(scriptText: string): Promise<{ url: string; durationSec: number }> {
  // TODO: Vertex AI TTS呼び出しをClaude Codeが実装
  await new Promise(resolve => setTimeout(resolve, 2000))
  console.log('Generate audio for:', scriptText.slice(0, 50))
  return {
    url: '/mock-audio.mp3',
    durationSec: Math.floor(scriptText.length / 10) + 30,
  }
}

// 番組関連
export async function getPrograms(): Promise<Program[]> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_PROGRAMS
}

export async function getProgramById(id: string): Promise<Program | null> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_PROGRAMS.find(p => p.id === id) ?? null
}

export async function saveProgram(program: Program): Promise<Program> {
  // TODO: API接続はClaude Codeが実装
  return program
}

export async function deleteProgram(id: string): Promise<void> {
  // TODO: API接続はClaude Codeが実装
  console.log('Delete program:', id)
}

// ポーリングサイト関連
export async function getPollingSites(): Promise<PollingSite[]> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_POLLING_SITES
}

export async function savePollingSite(site: PollingSite): Promise<PollingSite> {
  // TODO: API接続はClaude Codeが実装
  return site
}

export async function deletePollingSite(id: string): Promise<void> {
  // TODO: API接続はClaude Codeが実装
  console.log('Delete polling site:', id)
}

// 有効番組を取得（クライアント向け）
export async function getEnabledPrograms(): Promise<Program[]> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_PROGRAMS.filter(p => p.enabled)
}

// getProgram エイリアス（getProgramById の別名）
export const getProgram = getProgramById

// コンテンツ更新
export async function updateContent(id: string, data: Partial<Content>): Promise<Content> {
  // TODO: API接続はClaude Codeが実装
  const existing = MOCK_CONTENTS.find(c => c.id === id)
  return { ...(existing ?? MOCK_CONTENTS[0]), ...data, id }
}

// 番組有効/無効切替
export async function updateProgramEnabled(id: string, enabled: boolean): Promise<void> {
  // TODO: API接続はClaude Codeが実装
  console.log('Update program enabled:', id, enabled)
}

// ============================================
// バス関連
// ============================================

const MOCK_BUSES: Bus[] = [
  {
    id: 'bus-001',
    busCode: 'BUS-001',
    busName: '安曇野北ルート1号車',
    deviceToken: 'tok_abc123def456',
    lastConnectedAt: '2026-05-06T08:30:00Z',
    enabled: true,
  },
  {
    id: 'bus-002',
    busCode: 'BUS-002',
    busName: '安曇野南ルート1号車',
    deviceToken: 'tok_xyz789ghi012',
    lastConnectedAt: '2026-05-05T17:00:00Z',
    enabled: true,
  },
  {
    id: 'bus-003',
    busCode: 'BUS-003',
    busName: '穂高シャトル',
    deviceToken: 'tok_pqr345stu678',
    enabled: false,
  },
]

export async function getBuses(): Promise<Bus[]> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_BUSES
}

export async function createBus({ busCode, busName }: { busCode: string; busName: string }): Promise<Bus> {
  // TODO: API接続はClaude Codeが実装
  const newBus: Bus = {
    id: `bus-${Date.now()}`,
    busCode,
    busName,
    deviceToken: `tok_${Math.random().toString(36).slice(2, 14)}`,
    enabled: true,
  }
  return newBus
}

export async function disableBus(id: string): Promise<void> {
  // TODO: API接続はClaude Codeが実装
  console.log('Disable bus:', id)
}

// ============================================
// 再生ログ関連
// ============================================

const MOCK_TRIPS: Trip[] = [
  {
    id: 'trip-001',
    busCode: 'BUS-001',
    startedAt: '2026-05-06T08:00:00Z',
    endedAt: '2026-05-06T10:30:00Z',
    playCount: 5,
  },
  {
    id: 'trip-002',
    busCode: 'BUS-002',
    startedAt: '2026-05-06T09:00:00Z',
    endedAt: '2026-05-06T11:00:00Z',
    playCount: 3,
  },
  {
    id: 'trip-003',
    busCode: 'BUS-001',
    startedAt: '2026-05-05T13:00:00Z',
    endedAt: '2026-05-05T15:30:00Z',
    playCount: 4,
  },
]

const MOCK_PLAY_EVENTS: Record<string, PlayEvent[]> = {
  'trip-001': [
    { id: 'ev-001', contentTitle: '安曇野わさび農場 秋の収穫祭', status: 'completed', playedAt: '2026-05-06T08:15:00Z' },
    { id: 'ev-002', contentTitle: '穂高神社 例大祭のお知らせ', status: 'completed', playedAt: '2026-05-06T08:35:00Z' },
    { id: 'ev-003', contentTitle: '道の駅 新商品情報', status: 'skipped', playedAt: '2026-05-06T09:00:00Z' },
    { id: 'ev-004', contentTitle: '北アルプス紅葉情報', status: 'completed', playedAt: '2026-05-06T09:30:00Z' },
    { id: 'ev-005', contentTitle: '安曇野市観光案内', status: 'error', playedAt: '2026-05-06T10:00:00Z' },
  ],
  'trip-002': [
    { id: 'ev-006', contentTitle: '安曇野わさび農場 秋の収穫祭', status: 'completed', playedAt: '2026-05-06T09:15:00Z' },
    { id: 'ev-007', contentTitle: '穂高神社 例大祭のお知らせ', status: 'completed', playedAt: '2026-05-06T09:45:00Z' },
    { id: 'ev-008', contentTitle: '道の駅 新商品情報', status: 'completed', playedAt: '2026-05-06T10:15:00Z' },
  ],
  'trip-003': [
    { id: 'ev-009', contentTitle: '安曇野わさび農場 秋の収穫祭', status: 'completed', playedAt: '2026-05-05T13:15:00Z' },
    { id: 'ev-010', contentTitle: '北アルプス紅葉情報', status: 'completed', playedAt: '2026-05-05T13:45:00Z' },
    { id: 'ev-011', contentTitle: '道の駅 新商品情報', status: 'skipped', playedAt: '2026-05-05T14:15:00Z' },
    { id: 'ev-012', contentTitle: '安曇野市観光案内', status: 'completed', playedAt: '2026-05-05T14:45:00Z' },
  ],
}

export async function getTrips({ date, busCode }: { date?: string; busCode?: string } = {}): Promise<Trip[]> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_TRIPS.filter(t => {
    if (date && !t.startedAt.startsWith(date)) return false
    if (busCode && t.busCode !== busCode) return false
    return true
  })
}

export async function getPlayEventsByTripId(tripId: string): Promise<PlayEvent[]> {
  // TODO: API接続はClaude Codeが実装
  return MOCK_PLAY_EVENTS[tripId] ?? []
}

// ============================================
// ユーザー・設定関連
// ============================================

export async function getUserProfile(): Promise<UserProfile> {
  // TODO: API接続はClaude Codeが実装
  return { displayName: '管理者', email: 'admin@example.com' }
}

export async function updateUserProfile({ displayName }: { displayName: string }): Promise<void> {
  // TODO: API接続はClaude Codeが実装
  console.log('Update user profile:', displayName)
}

export async function changePassword({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }): Promise<void> {
  // TODO: API接続はClaude Codeが実装
  console.log('Change password', currentPassword.length, newPassword.length)
}

export async function clearAudioCache(): Promise<void> {
  // TODO: Phase 2で実装
  throw new Error('未実装')
}

export async function exportPlayLogs(): Promise<void> {
  // TODO: Phase 2で実装
  throw new Error('未実装')
}

// ============================================
// 認証関連
// ============================================

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Supabase Auth接続はClaude Codeが実装
  await new Promise(resolve => setTimeout(resolve, 500))
  if (email && password.length >= 8) {
    return { success: true }
  }
  return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' }
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  // TODO: Supabase Auth接続はClaude Codeが実装
  await new Promise(resolve => setTimeout(resolve, 500))
  console.log('Request password reset for:', email)
  return { success: true }
}

export async function resetPassword(token: string, password: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Supabase Auth接続はClaude Codeが実装
  await new Promise(resolve => setTimeout(resolve, 500))
  console.log('Reset password with token:', token, 'password length:', password.length)
  return { success: true }
}
