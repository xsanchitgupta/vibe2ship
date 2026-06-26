import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase auth middleware — refreshes the session token on every navigation.
 * Without this, the server-side `getUser()` call sees stale / missing cookies
 * and the Navbar never shows "Profile" after login.
 *
 * This is the canonical pattern from the Supabase + Next.js docs.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return supabaseResponse;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // 1. Set cookies on the request (so downstream server code sees them)
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        // 2. Create a new response that carries the updated request
        supabaseResponse = NextResponse.next({ request });
        // 3. Set the same cookies on the response (so they reach the browser)
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: Do NOT use getSession() here — it reads from the token without
  // verifying. getUser() contacts the Supabase Auth server to validate, and
  // as a side-effect refreshes the token if it's about to expire.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
