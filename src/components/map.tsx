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
  shapePolylines?: { points: { lat: number; lng: number }[] }[]
  stopMarkers?: { lat: number; lng: number; name: string }[]
  highlightedStopIndex?: number | null
  fitBoundsTarget?: { points: { lat: number; lng: number }[]; key: number } | null
  markers?: MapMarker[]
  selectedMarkerId?: string | null
  onMapClick?: (position: { lat: number; lng: number }) => void
  onMarkerClick?: (markerId: string) => void
  onStopMarkerClick?: (index: number) => void
  showSearch?: boolean
  className?: string
}

interface MapTilerFeature {
  place_name: string
  geometry: { coordinates: [number, number] }
}

function createStopIcon(num: number, fillColor: string, size: number): L.DivIcon {
  const fontSize = size <= 20 ? 10 : 12
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${fillColor};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:${fontSize}px;font-weight:700;line-height:1;">${num}</div>`,
    className: '',
    iconSize: [size, size] as L.PointExpression,
    iconAnchor: [size / 2, size / 2] as L.PointExpression,
    tooltipAnchor: [0, -(size / 2)] as L.PointExpression,
  })
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

export function MapView({
  center,
  zoom = 14,
  routePoints = [],
  shapePolylines = [],
  stopMarkers = [],
  highlightedStopIndex = null,
  fitBoundsTarget = null,
  markers = [],
  selectedMarkerId,
  onMapClick,
  onMarkerClick,
  onStopMarkerClick,
  showSearch = false,
  className = '',
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map())
  const polylineRef = useRef<L.Polyline | null>(null)
  const shapePolylinesRef = useRef<L.Polyline[]>([])
  const stopMarkersRef = useRef<L.Marker[]>([])

  // マップの初期化
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapRef.current = L.map(containerRef.current).setView([center.lat, center.lng], zoom)

    L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${publicEnv.NEXT_PUBLIC_MAPTILER_KEY}`, {
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

  // fitBounds: インポート完了後に点列のboundsに合わせる
  useEffect(() => {
    if (!mapRef.current || !fitBoundsTarget || fitBoundsTarget.points.length === 0) return
    const bounds = L.latLngBounds(
      fitBoundsTarget.points.map((p) => [p.lat, p.lng] as [number, number])
    )
    mapRef.current.fitBounds(bounds, { animate: false, padding: [40, 40] })
  }, [fitBoundsTarget?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // shape ポリラインの更新（routePoints より前に描画）
  useEffect(() => {
    if (!mapRef.current) return

    shapePolylinesRef.current.forEach((p) => p.remove())
    shapePolylinesRef.current = []

    shapePolylines.forEach((shape) => {
      if (shape.points.length < 2) return
      const latLngs = shape.points.map((p) => [p.lat, p.lng] as [number, number])
      const polyline = L.polyline(latLngs, {
        weight: 3,
        color: '#78808E',
        opacity: 0.7,
      }).addTo(mapRef.current!)
      shapePolylinesRef.current.push(polyline)
    })
  }, [shapePolylines])

  // バス停マーカーの更新（連番 divIcon、インポート時に再生成）
  useEffect(() => {
    if (!mapRef.current) return

    stopMarkersRef.current.forEach((m) => m.remove())
    stopMarkersRef.current = []

    stopMarkers.forEach((s, i) => {
      const isHighlighted = highlightedStopIndex === i
      const fillColor = isHighlighted ? '#FB7342' : '#FA5012'
      const size = isHighlighted ? 28 : 20

      const marker = L.marker([s.lat, s.lng], {
        icon: createStopIcon(i + 1, fillColor, size),
      }).addTo(mapRef.current!)

      // mouseover で stop_name をツールチップ表示
      marker.bindTooltip(s.name, { direction: 'top', offset: [0, -(size / 2)] })

      if (onStopMarkerClick) {
        marker.on('click', () => onStopMarkerClick(i))
      }

      stopMarkersRef.current.push(marker)
    })
  }, [stopMarkers, onStopMarkerClick]) // eslint-disable-line react-hooks/exhaustive-deps

  // ハイライト変化時のみアイコン更新（マーカー再生成なし）
  useEffect(() => {
    stopMarkersRef.current.forEach((marker, i) => {
      const isHighlighted = highlightedStopIndex === i
      const fillColor = isHighlighted ? '#FB7342' : '#FA5012'
      const size = isHighlighted ? 28 : 20
      marker.setIcon(createStopIcon(i + 1, fillColor, size))
    })
  }, [highlightedStopIndex])

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

  // 紐付けセットマーカーの更新（circleMarker）
  useEffect(() => {
    if (!mapRef.current) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()

    markers.forEach((m) => {
      const isSelected = m.id === selectedMarkerId
      const fillColor = isSelected ? '#5B7DBE' : '#FA5012'

      const circleMarker = L.circleMarker([m.position.lat, m.position.lng], {
        radius: 10,
        color: 'white',
        fillColor,
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(mapRef.current!)

      if (m.label) {
        circleMarker.bindPopup(m.label)
      }

      if (onMarkerClick) {
        circleMarker.on('click', () => onMarkerClick(m.id))
      }

      markersRef.current.set(m.id, circleMarker)
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
