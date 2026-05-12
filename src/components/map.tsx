'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { publicEnv } from '@/lib/env'

// Leafletのデフォルトアイコンの修正
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export interface MapMarker {
  id: string
  position: { lat: number; lng: number }
  label?: string
  color?: 'blue' | 'red' | 'green' | 'gray'
}

export interface MapProps {
  center: { lat: number; lng: number }
  zoom?: number
  routePoints?: { lat: number; lng: number }[]
  markers?: MapMarker[]
  selectedMarkerId?: string | null
  onMapClick?: (position: { lat: number; lng: number }) => void
  onMarkerClick?: (markerId: string) => void
  showSearch?: boolean
  className?: string
}

interface MapTilerFeature {
  place_name: string
  geometry: { coordinates: [number, number] }
}

function MapSearchBox({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MapTilerFeature[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = async () => {
    if (!query.trim() || isLoading) return
    setIsLoading(true)
    try {
      const res = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(query.trim())}.json?key=${publicEnv.NEXT_PUBLIC_MAPTILER_KEY}&language=ja&limit=5`
      )
      const data: { features: MapTilerFeature[] } = await res.json()
      setResults(data.features)
      setShowDropdown(true)
    } catch {
      // ネットワークエラー時はドロップダウンを閉じたまま
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div ref={containerRef} className="absolute top-2 right-2 z-[1000] w-72">
      <div className="flex overflow-hidden rounded-md shadow-md">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="地名・施設名で検索"
          className="flex-1 border-0 bg-white px-3 py-1.5 text-sm outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="border-l bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? '…' : '検索'}
        </button>
      </div>
      {showDropdown && results.length > 0 && (
        <ul className="mt-1 max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-md bg-white shadow-md">
          {results.map((r, i) => (
            <li key={i}>
              <button
                className="w-full px-3 py-2 text-left text-sm [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden hover:bg-gray-50"
                onClick={() => {
                  onSelect(r.geometry.coordinates[1], r.geometry.coordinates[0])
                  setShowDropdown(false)
                }}
              >
                {r.place_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showDropdown && results.length === 0 && !isLoading && (
        <div className="mt-1 rounded-md bg-white px-3 py-2 text-sm text-gray-500 shadow-md">
          結果が見つかりませんでした
        </div>
      )}
    </div>
  )
}

function createColoredIcon(color: string): L.Icon {
  const colorMap: Record<string, string> = {
    blue: '#5B7DBE',
    red: '#D86A6A',
    green: '#4D9B6F',
    gray: '#78808E',
  }

  const fillColor = colorMap[color] || colorMap.blue

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="${fillColor}" stroke="#fff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z"/>
      <circle fill="#fff" cx="12" cy="12" r="5"/>
    </svg>
  `

  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  })
}

export function MapView({
  center,
  zoom = 14,
  routePoints = [],
  markers = [],
  selectedMarkerId,
  onMapClick,
  onMarkerClick,
  showSearch = false,
  className = '',
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const polylineRef = useRef<L.Polyline | null>(null)

  // マップの初期化
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapRef.current = L.map(containerRef.current).setView([center.lat, center.lng], zoom)

    const style = publicEnv.NEXT_PUBLIC_MAPTILER_STYLE_ADMIN ?? publicEnv.NEXT_PUBLIC_MAPTILER_STYLE ?? ''
    L.tileLayer(`https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.png?key=${publicEnv.NEXT_PUBLIC_MAPTILER_KEY}`, {
      attribution: '© <a href="https://www.maptiler.com/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(mapRef.current)

    if (onMapClick) {
      mapRef.current.on('click', (e) => {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
      })
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ルートラインの更新
  useEffect(() => {
    if (!mapRef.current) return

    if (polylineRef.current) {
      polylineRef.current.remove()
      polylineRef.current = null
    }

    if (routePoints.length >= 2) {
      const latLngs = routePoints.map((p) => [p.lat, p.lng] as [number, number])
      polylineRef.current = L.polyline(latLngs, {
        color: '#FA5012',
        weight: 4,
        opacity: 0.8,
      }).addTo(mapRef.current)
    }
  }, [routePoints])

  // マーカーの更新
  useEffect(() => {
    if (!mapRef.current) return

    // 既存マーカーをクリア
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()

    // 新しいマーカーを追加
    markers.forEach((m) => {
      const isSelected = m.id === selectedMarkerId
      const color = isSelected ? 'red' : (m.color ?? 'blue')
      const icon = createColoredIcon(color)

      const marker = L.marker([m.position.lat, m.position.lng], { icon }).addTo(mapRef.current!)

      if (m.label) {
        marker.bindPopup(m.label)
      }

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(m.id))
      }

      markersRef.current.set(m.id, marker)
    })
  }, [markers, selectedMarkerId, onMarkerClick])

  return (
    <div className={`relative w-full h-full min-h-[400px] isolate ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {showSearch && (
        <MapSearchBox
          onSelect={(lat, lng) => mapRef.current?.setView([lat, lng], 15)}
        />
      )}
    </div>
  )
}

// SSR無効化用のダイナミックインポートラッパー
export default MapView
