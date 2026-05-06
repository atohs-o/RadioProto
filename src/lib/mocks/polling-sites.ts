import type { PollingSite } from '@/lib/schemas/polling-sites'

export const MOCK_POLLING_SITES: PollingSite[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: '安曇野市観光協会',
    url: 'https://azumino-kanko.jp/news',
    enabled: true,
    lastFetchedAt: '2026-05-05T10:30:00+09:00',
    lastStatus: 'success',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: '穂高神社公式サイト',
    url: 'https://hotakajinja.com/events',
    enabled: true,
    lastFetchedAt: '2026-05-05T10:25:00+09:00',
    lastStatus: 'success',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: '大王わさび農場',
    url: 'https://www.daiowasabi.co.jp/info',
    enabled: false,
    lastFetchedAt: '2026-05-04T18:00:00+09:00',
    lastStatus: 'failure',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: '松本市役所お知らせ',
    url: 'https://www.city.matsumoto.nagano.jp/news',
    enabled: true,
    lastFetchedAt: '2026-05-05T09:00:00+09:00',
    lastStatus: 'success',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: '信州まつもと空港',
    url: 'https://www.matsumoto-airport.co.jp/info',
    enabled: true,
    lastStatus: 'pending',
  },
]
