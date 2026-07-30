import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// How long to wait on any Supabase auth check before giving up. Every route
// in this app calls .auth.getUser() directly after createClient() — without
// a timeout, a slow/paused/unreachable Supabase project hangs every single
// page load and API call forever (this is what caused the "just spinning"
// bug: app/(app)/layout.tsx's own unguarded auth check, separate from the
// one in proxy.ts).
const AUTH_CHECK_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

// Server-side Supabase client scoped to the current request's auth cookies.
// RLS (see supabase/migrations/0001_init.sql) is the real access boundary —
// this never uses the service-role key.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore since
            // the proxy (see proxy.ts) refreshes the session cookie already.
          }
        },
      },
    }
  )
}

// Drop-in replacement for `supabase.auth.getUser()` that can never hang a
// request forever. Same return shape (`{ data: { user } }`), so existing
// call sites only need `supabase.auth.getUser()` swapped for
// `getAuthedUser(supabase)` — on timeout/failure it resolves to a null user,
// which every call site already treats as "unauthorized" / "redirect to
// sign-in".
export async function getAuthedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    return await withTimeout(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS, 'Supabase auth check')
  } catch (err) {
    console.error('[auth] Supabase auth check failed or timed out:', err)
    return { data: { user: null }, error: null } as Awaited<ReturnType<typeof supabase.auth.getUser>>
  }
}
