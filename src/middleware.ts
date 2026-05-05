import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() はトークンのリフレッシュも行う（getSession() は使わない）
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/reset-password')
  const isClientRoute =
    pathname.startsWith('/client') || pathname.startsWith('/api/client')

  // 車内クライアントルートは Supabase Auth 対象外（デバイストークン認証）
  if (isClientRoute) return supabaseResponse

  // 未認証ユーザーが認証不要ルート以外にアクセス → /login へリダイレクト
  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 認証済みユーザーが認証ルートにアクセス → /contents へリダイレクト
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/contents', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
