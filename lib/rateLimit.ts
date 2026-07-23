import type { SupabaseClient } from '@supabase/supabase-js';

export const MAX_MESSAGES = Number(process.env.RATE_LIMIT_MAX_MESSAGES || 15);

export interface RateLimitResult {
  ok: boolean;
  messageCount: number;
}

// Atomically increments sessions.message_count via the increment_message_count
// SQL function (supabase/migrations/0001_init.sql), so a 16th submission is
// rejected outright with no partial processing (§10.2). Used for the 4
// non-round charged actions (§10.1); the round pipeline itself charges only
// after the alignment call succeeds (§10.3), handled separately in
// app/api/round/route.ts.
export async function chargeMessage(supabase: SupabaseClient, sessionId: string): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('increment_message_count', {
    p_session_id: sessionId,
    p_max: MAX_MESSAGES,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, messageCount: MAX_MESSAGES };
  return { ok: true, messageCount: row.new_count };
}

export function rateLimitResponseBody() {
  return { error: 'rate_limited', upgradeHint: true };
}
