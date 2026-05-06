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
