import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy-client';

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same functionality).
// proxy-client.ts now guards the Supabase call with a timeout, so this can
// no longer hang the whole app even if Supabase is slow/paused/unreachable.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
