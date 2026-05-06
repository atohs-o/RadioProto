import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Program } from '@/lib/schemas'

const RouteGeometryPointSchema = z.object({ lat: z.number(), lng: z.number() })

function parseRouteGeometry(geometry: unknown): { lat: number; lng: number }[] {
  const result = z.array(RouteGeometryPointSchema).safeParse(geometry)
  return result.success ? result.data : []
}

export async function getPrograms(): Promise<Program[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('radio_programs')
    .select(`
      id, name, is_active, updated_at,
      radio_program_items (
        id, lat, lng, display_name, content_id, sequence,
        contents ( title ),
        audio_files ( duration_seconds )
      ),
      routes ( geometry )
    `)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const route = Array.isArray(row.routes) ? row.routes[0] : null
    const routePoints = parseRouteGeometry(route?.geometry)

    const rawItems = Array.isArray(row.radio_program_items) ? row.radio_program_items : []
    const items = rawItems
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((item) => {
        const content = Array.isArray(item.contents) ? item.contents[0] : item.contents
        const audioFile = Array.isArray(item.audio_files) ? item.audio_files[0] : item.audio_files
        return {
          id: item.id,
          position: { lat: Number(item.lat), lng: Number(item.lng) },
          locationName: item.display_name ?? '',
          contentId: item.content_id,
          contentTitle: (content as { title?: string } | null)?.title ?? '',
          audioDurationSec: (audioFile as { duration_seconds?: number | null } | null)?.duration_seconds ?? 0,
        }
      })

    return {
      id: row.id,
      name: row.name,
      enabled: row.is_active,
      routePoints,
      items,
      updatedAt: row.updated_at,
    }
  })
}

export async function getProgram(id: string): Promise<Program | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('radio_programs')
    .select(`
      id, name, is_active, updated_at,
      radio_program_items (
        id, lat, lng, display_name, content_id, sequence,
        contents ( title ),
        audio_files ( duration_seconds )
      ),
      routes ( geometry )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const route = Array.isArray(data.routes) ? data.routes[0] : null
  const routePoints = parseRouteGeometry(route?.geometry)

  const rawItems = Array.isArray(data.radio_program_items) ? data.radio_program_items : []
  const items = rawItems
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((item) => {
      const content = Array.isArray(item.contents) ? item.contents[0] : item.contents
      const audioFile = Array.isArray(item.audio_files) ? item.audio_files[0] : item.audio_files
      return {
        id: item.id,
        position: { lat: Number(item.lat), lng: Number(item.lng) },
        locationName: item.display_name ?? '',
        contentId: item.content_id,
        contentTitle: (content as { title?: string } | null)?.title ?? '',
        audioDurationSec: (audioFile as { duration_seconds?: number | null } | null)?.duration_seconds ?? 0,
      }
    })

  return {
    id: data.id,
    name: data.name,
    enabled: data.is_active,
    routePoints,
    items,
    updatedAt: data.updated_at,
  }
}

