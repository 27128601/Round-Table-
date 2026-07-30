import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// How long to wait on the Supabase auth check before giving up. Without this,
// a paused/unreachable/slow Supabase project hangs every single request,
// since this runs on nearly every route (see matcher below).
const AUTH_CHECK_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

// Refreshes the Supabase auth cookie on every request and gates access to
// the authenticated app. Sign-up/sign-in is required before any debate can
// run — no anonymous trial (§8.1).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/sign-in') || path.startsWith('/sign-up')

  let user = null
  try {
    const result = await withTimeout(
      supabase.auth.getUser(),
      AUTH_CHECK_TIMEOUT_MS,
      'Supabase auth check'
    )
    user = result.data.user
  } catch (err) {
    // Supabase unreachable/paused/slow — never hang the whole app on this.
    // Fail closed (still requires real auth once Supabase responds again).
    console.error('[proxy] Supabase auth check failed or timed out:', err)
    if (!isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/sign-in'
      return NextResponse.redirect(url)
    }
    return response
  }

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}
