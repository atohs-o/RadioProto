import { z } from 'zod'

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_MAPTILER_KEY: z.string().min(1),
  NEXT_PUBLIC_MAPTILER_STYLE_ADMIN: z.string().min(1).optional(),
  NEXT_PUBLIC_MAPTILER_STYLE_CLIENT: z.string().min(1).optional(),
  NEXT_PUBLIC_MAPTILER_STYLE: z.string().min(1).optional(),
})

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_MAPTILER_KEY: process.env.NEXT_PUBLIC_MAPTILER_KEY,
  NEXT_PUBLIC_MAPTILER_STYLE_ADMIN: process.env.NEXT_PUBLIC_MAPTILER_STYLE_ADMIN,
  NEXT_PUBLIC_MAPTILER_STYLE_CLIENT: process.env.NEXT_PUBLIC_MAPTILER_STYLE_CLIENT,
  NEXT_PUBLIC_MAPTILER_STYLE: process.env.NEXT_PUBLIC_MAPTILER_STYLE,
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  GCP_LOCATION: z.string().default('us-central1'),
})

// サーバー専用（Server Component / API Route / Edge Function からのみ呼ぶ）
export function getServerEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
    GCP_LOCATION: process.env.GCP_LOCATION,
  })
}
