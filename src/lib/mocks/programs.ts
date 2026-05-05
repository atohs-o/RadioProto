import type { Program } from '@/lib/schemas'

export const MOCK_PROGRAMS: Program[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: '安曇野北部ルート',
    enabled: true,
    routePoints: [
      { lat: 36.3006, lng: 137.8729 },
      { lat: 36.3100, lng: 137.8800 },
      { lat: 36.3234, lng: 137.8821 },
    ],
    items: [
      {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567001',
        position: { lat: 36.3006, lng: 137.8729 },
        locationName: '穂高駅前',
        contentTitle: '安曇野わさび農場 秋の収穫祭',
        audioDurationSec: 95,
      },
      {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567002',
        position: { lat: 36.3234, lng: 137.8821 },
        locationName: '大王わさび農場',
        contentTitle: '大王わさび農場のご案内',
        audioDurationSec: 120,
      },
    ],
    updatedAt: '2026-05-01T10:30:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: '松本城周遊ルート',
    enabled: true,
    routePoints: [
      { lat: 36.2388, lng: 137.9686 },
      { lat: 36.2400, lng: 137.9700 },
      { lat: 36.2420, lng: 137.9720 },
    ],
    items: [
      {
        id: 'b2c3d4e5-f6a7-8901-bcde-f23456789001',
        position: { lat: 36.2388, lng: 137.9686 },
        locationName: '松本城入口',
        contentTitle: '国宝松本城のご紹介',
        audioDurationSec: 180,
      },
    ],
    updatedAt: '2026-04-28T14:20:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: '白馬スキー場ルート',
    enabled: false,
    routePoints: [
      { lat: 36.6983, lng: 137.8619 },
      { lat: 36.7000, lng: 137.8650 },
    ],
    items: [],
    updatedAt: '2026-03-15T09:00:00Z',
  },
]
