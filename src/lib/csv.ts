export interface GTFSStop {
  stopName: string
  lat: number
  lng: number
}

export interface GTFSParseResult {
  stops: GTFSStop[]
  skipped: number
}

export function parseGTFSStops(text: string): GTFSParseResult {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { stops: [], skipped: 0 }

  const stripQuotes = (s: string) => s.trim().replace(/^"|"$/g, '')
  const headers = lines[0].split(',').map(stripQuotes)

  const nameIdx = headers.findIndex((h) => h === 'stop_name')
  const latIdx = headers.findIndex((h) => h === 'stop_lat')
  const lonIdx = headers.findIndex((h) => h === 'stop_lon')

  if (nameIdx === -1 || latIdx === -1 || lonIdx === -1) {
    const missing = ['stop_name', 'stop_lat', 'stop_lon']
      .filter((col) => !headers.includes(col))
      .join('・')
    throw new Error(`必須列が見つかりません: ${missing}`)
  }

  const stops: GTFSStop[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(stripQuotes)
    const stopName = cols[nameIdx] ?? ''
    const lat = parseFloat(cols[latIdx] ?? '')
    const lng = parseFloat(cols[lonIdx] ?? '')

    if (!stopName || isNaN(lat) || isNaN(lng)) {
      skipped++
      continue
    }
    stops.push({ stopName, lat, lng })
  }

  return { stops, skipped }
}

export async function importRouteCSV(file: File): Promise<{ lat: number; lng: number }[]> {
  const text = await file.text()
  const lines = text.trim().split(/\r?\n/)
  if (lines.length === 0) return []

  let startIndex = 0
  let latCol = 0
  let lngCol = 1

  const firstLine = lines[0].toLowerCase()
  const headers = firstLine.split(',').map((h) => h.trim())
  const latIdx = headers.findIndex((h) => h === 'lat' || h === 'latitude')
  const lngIdx = headers.findIndex((h) => h === 'lng' || h === 'longitude')
  if (latIdx !== -1 && lngIdx !== -1) {
    latCol = latIdx
    lngCol = lngIdx
    startIndex = 1
  }

  const points: { lat: number; lng: number }[] = []
  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const lat = parseFloat(cols[latCol]?.trim() ?? '')
    const lng = parseFloat(cols[lngCol]?.trim() ?? '')
    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng })
    }
  }
  return points
}
