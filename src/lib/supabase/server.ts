import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from '@/lib/config';

// Server client bound to the request cookies (respects RLS as the logged-in user).
export async function createClient(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled()) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // called from a Server Component — safe to ignore, middleware refreshes
        }
      },
    },
  });
}

// Service-role client — bypasses RLS for trusted server work (the triage agent
// filing issues, seeding, analytics). Never import this into client code.
export function createServiceClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createAdminClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
