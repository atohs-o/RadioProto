'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
  className?: string
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[400px] ${className}`}
    />
  )
}

// SSR無効化用のダイナミックインポートラッパー
export default MapView
