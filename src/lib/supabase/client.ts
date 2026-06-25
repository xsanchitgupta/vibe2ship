'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from '@/lib/config';

// Browser client — used for auth UI and realtime subscriptions.
export function createClient() {
  if (!supabaseEnabled()) return null;
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
