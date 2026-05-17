'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { publicEnv } from '@/lib/env'
import { haversineDistance } from '@/lib/geo'

interface RoutePoint {
  lat: number
  lng: number
}

interface ProgramItem {
  id: string
  position: { lat: number; lng: number }
  locationName: string
  contentTitle: string
  audioDurationSec: number
}

interface PlayMapProps {
  routePoints: RoutePoint[]
  items: ProgramItem[]
  currentPosition: { lat: number; lng: number } | null | undefined
  playingItemId?: string
  playedItemIds?: string[]
  shapePoints?: { lat: number; lng: number }[]
  splitItem?: { lat: number; lng: number } | null
}

// 現在位置マーカー（青い丸）
const currentPositionIcon = L.divIcon({
  className: 'current-position-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background-color: #5B7DBE;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// コンテンツピンアイコン生成（涙型+音符）
function createPinIcon(status: 'waiting' | 'playing' | 'played'): L.DivIcon {
  const color = {
    waiting: '#FA5012',
    playing: '#4D9B6F',
    played:  '#9AA0AB',
  }[status]
  const ringColor = {
    waiting: 'rgba(250,80,18,0.25)',
    playing: 'rgba(77,155,111,0.25)',
    played:  'rgba(154,160,171,0.25)',
  }[status]
  const size = 32
  const anchorY = size - 2

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.25)}" viewBox="0 0 32 40">
    <defs>
      <filter id="ps" x="-30%" y="-20%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="${color}" flood-opacity="0.45"/>
      </filter>
    </defs>
    <circle cx="16" cy="13" r="12" fill="${ringColor}" stroke="none"/>
    <path d="M16 2C10.477 2 6 6.477 6 12C6 19.5 16 30 16 30C16 30 26 19.5 26 12C26 6.477 21.523 2 16 2Z"
      fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round" filter="url(#ps)"/>
    <circle cx="16" cy="12" r="5.5" fill="white" fill-opacity="0.92"/>
    <text x="16" y="15.5" text-anchor="middle" font-family="sans-serif" font-size="8" font-weight="700" fill="${color}">♪</text>
  </svg>`

  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [size, Math.round(size * 1.25)],
    iconAnchor: [size / 2, anchorY],
  })
}

// 現在位置追従コンポーネント
function FollowCurrentPosition({ position }: { position: { lat: number; lng: number } | null | undefined }) {
  const map = useMap()
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (position && !hasInitialized.current) {
      map.setView([position.lat, position.lng], 15)
      hasInitialized.current = true
    }
  }, [map, position])

  return null
}

export default function PlayMap({
  routePoints,
  items,
  currentPosition,
  playingItemId,
  playedItemIds = [],
  shapePoints,
  splitItem,
}: PlayMapProps) {
  // shapes があれば優先、なければ routePoints にフォールバック
  const basePoints = shapePoints && shapePoints.length > 1 ? shapePoints : routePoints

  // splitItem の最近傍点でポリラインを通過済み／未通過に分割
  let passedPositions: [number, number][] = []
  let upcomingPositions: [number, number][] = basePoints.map((p) => [p.lat, p.lng])

  if (splitItem && basePoints.length > 1) {
    let minDist = Infinity
    let splitIdx = 0
    basePoints.forEach((p, i) => {
      const d = haversineDistance(p, splitItem)
      if (d < minDist) {
        minDist = d
        splitIdx = i
      }
    })
    passedPositions = basePoints.slice(0, splitIdx + 1).map((p) => [p.lat, p.lng])
    upcomingPositions = basePoints.slice(splitIdx).map((p) => [p.lat, p.lng])
  }

  // 地図の初期中心点を計算
  const center: [number, number] = basePoints.length > 0
    ? [basePoints[0].lat, basePoints[0].lng]
    : [36.3006, 137.8729] // デフォルト: 穂高駅

  return (
    <MapContainer
      center={center}
      zoom={14}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='© <a href="https://www.maptiler.com/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${publicEnv.NEXT_PUBLIC_MAPTILER_KEY}`}
      />

      {/* 通過済み区間（グレー） */}
      {passedPositions.length > 1 && (
        <Polyline
          positions={passedPositions}
          pathOptions={{ color: '#9AA0AB', weight: 4, opacity: 0.8 }}
        />
      )}
      {/* 未通過区間（ブランドオレンジ） */}
      {upcomingPositions.length > 1 && (
        <Polyline
          positions={upcomingPositions}
          pathOptions={{ color: '#FA5012', weight: 4, opacity: 0.8 }}
        />
      )}

      {/* コンテンツピン */}
      {items.map((item, index) => {
        const status = item.id === playingItemId
          ? 'playing'
          : playedItemIds.includes(item.id)
          ? 'played'
          : index === 0 && !playingItemId
          ? 'playing'
          : 'waiting'

        return (
          <Marker
            key={item.id}
            position={[item.position.lat, item.position.lng]}
            icon={createPinIcon(status)}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{item.locationName}</div>
                <div className="text-muted-foreground">{item.contentTitle}</div>
                <div className="text-xs text-brand-gray">
                  {Math.floor(item.audioDurationSec / 60)}分{item.audioDurationSec % 60}秒
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {/* 現在位置マーカー */}
      {currentPosition && (
        <Marker
          position={[currentPosition.lat, currentPosition.lng]}
          icon={currentPositionIcon}
        >
          <Popup>現在地</Popup>
        </Marker>
      )}

      <FollowCurrentPosition position={currentPosition} />
    </MapContainer>
  )
}
