'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from '@/lib/config';

// Browser client — used for auth UI and realtime subscriptions.
//
// SINGLETON: every caller must share ONE instance. Creating multiple
// createBrowserClient instances spawns multiple GoTrueClients that contend on
// the `navigator.locks` auth lock — which DEADLOCKS authenticated queries
// (e.g. the profile fetch hangs forever, so the UI thinks you're logged out).
//
// Also: no custom cookieOptions (especially `domain`). The server writes
// HOST-ONLY cookies; a custom domain mismatches them (and `Domain=localhost` is
// rejected), breaking persistence. The @supabase/ssr defaults match the server.
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (!supabaseEnabled()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  }
  return browserClient;
}
