'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { publicEnv } from '@/lib/env'

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

// コンテンツピンアイコン生成
function createPinIcon(status: 'waiting' | 'playing' | 'played'): L.DivIcon {
  const colors = {
    waiting: '#5B7DBE',  // 青
    playing: '#4D9B6F',  // 緑
    played: '#78808E',   // グレー
  }
  const color = colors[status]

  return L.divIcon({
    className: 'content-pin-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
}: PlayMapProps) {
  // 路線ポイントを [lat, lng] 形式に変換
  const polylinePositions: [number, number][] = routePoints.map(p => [p.lat, p.lng])

  // 地図の初期中心点を計算
  const center: [number, number] = routePoints.length > 0
    ? [routePoints[0].lat, routePoints[0].lng]
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
        url={`https://api.maptiler.com/maps/${publicEnv.NEXT_PUBLIC_MAPTILER_STYLE_CLIENT ?? publicEnv.NEXT_PUBLIC_MAPTILER_STYLE ?? ''}/{z}/{x}/{y}.png?key=${publicEnv.NEXT_PUBLIC_MAPTILER_KEY}`}
      />

      {/* 路線ライン */}
      {polylinePositions.length > 1 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{
            color: '#FA5012',
            weight: 4,
            opacity: 0.8,
          }}
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
